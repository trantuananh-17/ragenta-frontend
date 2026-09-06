"use client";

import { useState } from "react";
import { Check, Loader2, Play, Square, X } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AnswerBody } from "@/features/chat/components/chat-message";
import { SourceList } from "@/features/chat/components/citations";
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
  const { run, stop, streaming, pending } = useRunAgent(workspaceId, agent.id);
  const inactive = agent.status !== "active";

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || pending) return;
    void run({ input: input.trim() });
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
        <Textarea
          rows={4}
          value={input}
          disabled={disabled || inactive}
          onChange={(event) => setInput(event.target.value)}
          placeholder="What should this agent work on?"
        />
        <div className="flex items-center justify-end gap-2">
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
              <Loader2 className="size-3.5 animate-spin" />
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
                <li key={`${entry.seq}-${entry.name}`} className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    {entry.ok === undefined ? (
                      <Loader2 className="size-3 animate-spin text-muted-foreground" />
                    ) : entry.ok ? (
                      <Check className="size-3 text-emerald-600" />
                    ) : (
                      <X className="size-3 text-destructive" />
                    )}
                    <span className="font-medium">{entry.name}</span>
                  </div>
                  <p className="truncate text-muted-foreground">
                    {entry.summary ?? entry.arguments}
                  </p>
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
        </div>
      )}
    </div>
  );
}
