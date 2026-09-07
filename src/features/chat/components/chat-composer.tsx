"use client";

import { useRef, useState } from "react";
import { ArrowUp, ImagePlus, Square } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
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
import {
  ACCEPTED_ATTACHMENT_TYPES,
  MAX_TURN_ATTACHMENTS,
  type MessageAttachment,
} from "../service/chat.service";
import { ComposerAttachments } from "./chat-attachments";

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
  const attachments = useComposerAttachments(workspaceId);
  const vision = useVisionSupport(workspaceId, model ?? null);

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

  const submit = () => {
    const content = value.trim();
    const ready = attachments.ready;
    // A question is text, images, or both — but not nothing. Waiting on an
    // upload rather than dropping it keeps a half-attached image from being
    // silently left behind.
    if ((!content && ready.length === 0) || pending || disabled) return;
    if (attachments.uploading) return;

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
