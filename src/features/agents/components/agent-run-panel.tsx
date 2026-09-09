"use client";

import { useRef, useState } from "react";
import { Check, ImagePlus, Play, Square, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { ComposerAttachments } from "@/features/chat/components/chat-attachments";
import { AnswerBody } from "@/features/chat/components/chat-message";
import { SourceList } from "@/features/chat/components/citations";
import { useComposerAttachments } from "@/features/chat/hooks/chat.hook";
import { ACCEPTED_ATTACHMENT_TYPES } from "@/features/chat/service/chat.service";
import { cn } from "@/lib/utils";
import { useRunAgent } from "../hooks/agents.hook";
import type { Agent } from "../service/agents.service";

/**
 * Run the agent and watch it answer.
 *
 * The output streams into local state and is left on screen after the run ends,
 * rather than being cleared and replaced by the persisted row: the row is one
 * refetch away in the run list, and blanking the text someone is still reading
 * to fetch the identical text back reads as a bug.
 */
export function AgentRunPanel({
  workspaceId,
  agent,
  disabled,
}: {
  workspaceId: string;
  agent: Agent;
  disabled?: boolean;
}) {
  const [input, setInput] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { run, resume, stop, streaming, pending } = useRunAgent(workspaceId, agent.id);
  /*
    The same hook the chat composer uses, unchanged. It is keyed on the
    workspace rather than on a conversation, which is what makes it fit here —
    an attachment belongs to the workspace until something claims it, and a run
    claims it exactly as a message does.
  */
  const attachments = useComposerAttachments(workspaceId);
  const inactive = agent.status !== "active";
  const awaiting = streaming?.awaiting ?? null;
  const mayAttach = !disabled && !inactive && !pending && !attachments.full;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || pending) return;
    const ready = attachments.ready.map((attachment) => attachment.id);
    void run({
      input: input.trim(),
      ...(ready.length > 0 ? { attachmentIds: ready } : {}),
    });
    // Cleared on send, not on the run finishing: an attachment may only be
    // claimed once, so leaving the strip up invites a second run that the
    // server refuses for a reason nothing on screen explains.
    attachments.clear();
  };

  return (
    <div className="space-y-4">
      {inactive && (
        <Alert>
          <AlertDescription>
            This agent is {agent.status}. Activate it before running it.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={submit} className="space-y-3">
        <div
          onDragOver={(event) => {
            // Swallowed whether or not the file can be attached: a drop the
            // browser handles itself opens the image and takes the run panel
            // off the screen.
            event.preventDefault();
            if (mayAttach) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (mayAttach) attachments.add(Array.from(event.dataTransfer.files));
          }}
          className={cn(
            "rounded-lg border bg-background transition-colors",
            "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20",
            dragging && "border-primary bg-accent/40",
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
            rows={4}
            value={input}
            disabled={disabled || inactive}
            className="border-0 shadow-none focus-visible:ring-0"
            onChange={(event) => setInput(event.target.value)}
            onPaste={(event) => {
              // Pasting a screenshot is how people actually attach one, and the
              // clipboard carries it as a file alongside the text. Only taken
              // when there is one, so pasting ordinary text still types.
              const files = Array.from(event.clipboardData.files);
              if (files.length === 0) return;
              event.preventDefault();
              if (mayAttach) attachments.add(files);
            }}
            placeholder="What should this agent work on?"
          />
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mr-auto"
            disabled={!mayAttach}
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus className="size-4" />
            {attachments.full ? "No room for more" : "Add an image"}
          </Button>
          {pending ? (
            <Button
              type="button"
              variant="outline"
              onClick={stop}
              disabled={streaming?.stopping}
            >
              <Square className="size-4" />
              {streaming?.stopping ? "Stopping…" : "Stop"}
            </Button>
          ) : (
            <Button
              type="submit"
              disabled={disabled || inactive || !input.trim()}
            >
              <Play className="size-4" />
              Run
            </Button>
          )}
        </div>
      </form>

      {streaming && (
        <div className="space-y-3 rounded-lg border p-4">
          {pending && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner className="size-3.5" />
              {streaming.phase === "retrieving"
                ? "Searching the knowledge bases…"
                : streaming.round
                  ? `Round ${streaming.round.round} of ${streaming.round.of}…`
                  : "Answering…"}
            </p>
          )}

          {streaming.timeline.length > 0 && (
            <ol className="space-y-1.5 border-l pl-3 text-xs">
              {streaming.timeline.map((entry) => (
                <li key={entry.key} className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    {entry.ok === undefined ? (
                      <Spinner className="size-3 text-muted-foreground" />
                    ) : entry.ok ? (
                      <Check className="size-3 text-success" />
                    ) : (
                      <X className="size-3 text-destructive" />
                    )}
                    <span className="font-medium">{entry.name}</span>
                    {entry.kind === "node" && (
                      <span className="text-xs text-muted-foreground">
                        {entry.detail}
                      </span>
                    )}
                  </div>
                  {(entry.summary || entry.kind === "tool") && (
                    <p className="truncate text-muted-foreground">
                      {entry.summary ?? entry.detail}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}

          {streaming.warning && (
            <Alert>
              <AlertDescription>{streaming.warning}</AlertDescription>
            </Alert>
          )}

          {streaming.output ? (
            <AnswerBody
              content={streaming.output}
              citations={streaming.citations}
            />
          ) : (
            !pending && (
              <p className="text-sm text-muted-foreground">
                The run produced no output.
              </p>
            )
          )}

          {streaming.citations.length > 0 && (
            <SourceList citations={streaming.citations} />
          )}

          {awaiting && streaming.runId && (
            /**
             * Two shapes of pause, one mechanism. A flow's `user_input` node asks
             * for values and gets text boxes; an approval asks a yes-or-no
             * question about something that has not happened yet and gets two
             * buttons — typing "yes" into a box to authorise an email would be
             * the wrong affordance for the decision being made.
             */
            awaiting.fields.length === 1 && awaiting.fields[0] === "approve" ? (
              <div className="space-y-2 rounded-md border border-warning/40 bg-warning/5 p-3">
                <p className="text-sm font-medium">Approval needed</p>
                <pre className="max-h-40 overflow-auto rounded-md bg-background p-2 text-xs whitespace-pre-wrap">
                  {awaiting.prompt}
                </pre>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => void resume(streaming.runId!, { approve: "yes" })}
                  >
                    Approve and continue
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => void resume(streaming.runId!, { approve: "no" })}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            ) : (
              <form
                className="space-y-2 rounded-md border border-dashed p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void resume(streaming.runId!, answers);
                  setAnswers({});
                }}
              >
                <p className="text-sm">{awaiting.prompt}</p>
                {awaiting.fields.map((field) => (
                  <div key={field} className="space-y-1">
                    <Label htmlFor={`answer-${field}`} className="text-xs">
                      {field}
                    </Label>
                    <Input
                      id={`answer-${field}`}
                      value={answers[field] ?? ""}
                      onChange={(event) =>
                        setAnswers((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
                <Button
                  type="submit"
                  size="sm"
                  disabled={awaiting.fields.some((field) => !answers[field]?.trim())}
                >
                  Continue
                </Button>
              </form>
            )
          )}
        </div>
      )}
    </div>
  );
}
