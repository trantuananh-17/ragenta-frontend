"use client";

import { useCallback, useRef, useState } from "react";
import { ArrowUp, ImagePlus, Mic, Square, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVisionSupport } from "@/features/models/hooks/models.hook";
import type { ModelSelection } from "@/features/models/service/models.service";
import { useWorkspaceId } from "@/features/workspace/components/workspace-provider";
import { cn } from "@/lib/utils";
import { useComposerAttachments } from "../hooks/chat.hook";
import { useVoiceInput } from "../hooks/speech.hook";
import {
  ACCEPTED_ATTACHMENT_TYPES,
  MAX_TURN_ATTACHMENTS,
  type MessageAttachment,
} from "../service/chat.service";
import { ComposerAttachments } from "./chat-attachments";

/** m:ss, so a long recording still reads as a duration rather than a count. */
function elapsed(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export interface ComposerSubmit {
  content: string;
  /** Already uploaded by the time this fires — the send only names their ids. */
  attachments: MessageAttachment[];
}

/**
 * The question box.
 *
 * Enter sends and Shift+Enter breaks the line — the convention every chat tool
 * uses, and getting it the other way round is instantly wrong to anyone who has
 * used one. Growth is CSS `field-sizing: content` with a max height, so the box
 * follows the text without a resize observer, and stops before it pushes the
 * answer off the screen.
 *
 * Images are uploaded as they are chosen rather than when the question is sent,
 * so the wait happens while it is still being typed.
 */
export function ChatComposer({
  onSubmit,
  onStop,
  pending,
  stopping,
  disabled,
  disabledReason,
  placeholder = "Ask a question about your documents...",
  toolbar,
  autoFocus,
  model,
}: {
  onSubmit: (input: ComposerSubmit) => void;
  onStop?: () => void;
  pending?: boolean;
  /** A stop is already in flight; the last tokens are still arriving. */
  stopping?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  placeholder?: string;
  toolbar?: React.ReactNode;
  autoFocus?: boolean;
  /**
   * The model this turn will run on, or null for the workspace default. Only
   * used to decide whether attaching an image is offered.
   */
  model?: ModelSelection | null;
}) {
  const workspaceId = useWorkspaceId();
  const [value, setValue] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const attachments = useComposerAttachments(workspaceId);
  const vision = useVisionSupport(workspaceId, model ?? null);

  /*
    A transcript lands in the box, not in the thread. It is a machine's reading
    of what somebody said — routinely wrong about a name or a number — so the
    person who said it gets to fix it before anyone is charged for an answer to
    the wrong question. Appended rather than replacing: whatever was already
    typed is theirs too.
  */
  const acceptTranscript = useCallback((text: string) => {
    setValue((current) => (current.trim() ? `${current.trimEnd()} ${text}` : text));
    textRef.current?.focus();
  }, []);

  const voice = useVoiceInput({
    workspaceId,
    attach: attachments.addRecording,
    onTranscript: acceptTranscript,
    onTranscribed: attachments.markTranscribed,
  });

  // Null is "not knowable yet", and the button stays available there: the
  // backend refuses a vision turn on a text-only model anyway, so a control
  // greyed out on a guess costs more than one that is refused.
  const visionRefused = vision === false;
  const mayAttach = !disabled && !pending && !visionRefused && !attachments.full;

  const attachLabel = visionRefused
    ? "This model cannot read images. Pick a vision model to attach one."
    : attachments.full
      ? `A question carries at most ${MAX_TURN_ATTACHMENTS} images.`
      : "Attach an image";

  const recording = voice.status === "recording";
  const mayRecord =
    !disabled && !pending && voice.supported && voice.available && !attachments.full;

  const recordLabel = !voice.supported
    ? "This browser cannot record audio."
    : !voice.available
      ? "Voice input is not enabled on this deployment."
      : attachments.full
        ? `A question carries at most ${MAX_TURN_ATTACHMENTS} files.`
        : "Record a question";

  const submit = () => {
    const content = value.trim();
    const ready = attachments.ready;
    // A question is text, images, or both — but not nothing. Waiting on an
    // upload rather than dropping it keeps a half-attached image from being
    // silently left behind.
    if ((!content && ready.length === 0) || pending || disabled) return;
    if (attachments.uploading) return;
    // A transcript still on its way is part of this question; sending now would
    // send the question without the words that were spoken into it.
    if (recording || voice.busy) return;

    setValue("");
    attachments.clear();
    onSubmit({ content, attachments: ready });
  };

  return (
    <div
      onDragOver={(event) => {
        // Swallowed whether or not the file can be attached: a drop the browser
        // handles itself opens the image and takes the thread off the screen.
        event.preventDefault();
        if (mayAttach) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (mayAttach) {
          attachments.add(Array.from(event.dataTransfer.files));
        } else if (visionRefused) {
          toast.error(attachLabel);
        }
      }}
      className={cn(
        "rounded-2xl border bg-background shadow-xs transition-colors",
        "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20",
        dragging && "border-primary bg-accent/40",
        disabled && "opacity-70",
      )}
    >
      <input
        ref={fileRef}
        type="file"
        multiple
        accept={ACCEPTED_ATTACHMENT_TYPES}
        className="hidden"
        onChange={(event) => {
          attachments.add(Array.from(event.target.files ?? []));
          // Cleared so choosing the same file twice fires a change both times.
          event.target.value = "";
        }}
      />

      <ComposerAttachments
        items={attachments.items}
        onRemove={attachments.remove}
        disabled={disabled}
      />

      <Textarea
        ref={textRef}
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={disabled ? (disabledReason ?? placeholder) : placeholder}
        rows={1}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        className="max-h-[220px] min-h-0 resize-none border-0 bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0"
      />

      <div className="flex items-center justify-between gap-2 border-t px-2 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <Tooltip>
            {/*
              Wrapped rather than triggered directly: a disabled button takes no
              pointer events, and the tooltip explaining *why* it is disabled is
              the one that most needs to appear.
            */}
            <TooltipTrigger asChild>
              <span className="inline-flex">
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  disabled={!mayAttach}
                  aria-label={attachLabel}
                  onClick={() => fileRef.current?.click()}
                >
                  <ImagePlus className="size-4" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>{attachLabel}</TooltipContent>
          </Tooltip>

          {recording ? (
            <div className="flex items-center gap-1 rounded-full border border-destructive/40 bg-destructive/5 py-0.5 pr-0.5 pl-2">
              <span className="size-2 animate-pulse rounded-full bg-destructive" />
              <span className="text-xs tabular-nums">{elapsed(voice.seconds)}</span>
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                aria-label="Discard recording"
                onClick={voice.cancel}
              >
                <X className="size-3.5" />
              </Button>
              <Button
                type="button"
                size="icon-xs"
                variant="secondary"
                aria-label="Stop recording and transcribe"
                onClick={voice.stop}
              >
                <Square className="size-3" />
              </Button>
            </div>
          ) : voice.busy ? (
            /*
              Named, and never a bare spinner: transcription runs roughly in real
              time on a self-hosted sidecar, so a minute of audio is a minute of
              waiting, and an unlabelled composer that will not send reads as one
              that has hung.
            */
            <span className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
              <Spinner className="size-3.5" />
              {voice.status === "uploading" ? "Uploading…" : "Transcribing…"}
            </span>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    disabled={!mayRecord}
                    aria-label={recordLabel}
                    onClick={() => void voice.start()}
                  >
                    <Mic className="size-4" />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{recordLabel}</TooltipContent>
            </Tooltip>
          )}

          {toolbar}
        </div>

        {pending && onStop ? (
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={onStop}
            disabled={stopping}
            aria-label={stopping ? "Stopping" : "Stop answering"}
          >
            <Square className="size-3.5" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon-sm"
            onClick={submit}
            disabled={
              disabled ||
              pending ||
              attachments.uploading ||
              recording ||
              voice.busy ||
              (value.trim().length === 0 && attachments.ready.length === 0)
            }
            aria-label="Send"
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
