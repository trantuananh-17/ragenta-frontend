"use client";

import { useState } from "react";
import { AlertCircle, Sparkles } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useGenerateGraph } from "@/features/agents/hooks/agents.hook";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import type { AgentGraph } from "./graph-model";

/**
 * Drafting a flow from a sentence.
 *
 * The blank canvas is the hard part of building an agent: seventeen node types
 * and no clue which three the job needs. Describing the job and correcting what
 * comes back is a different and much easier task than composing it.
 *
 * **Nothing here saves.** A draft replaces what is on the canvas and stays there
 * until the person publishes a version, which is the same thing dragging a node
 * does. That is what makes overwriting safe enough to offer: the worst case is
 * closing the editor without publishing.
 */
export function FlowPrompt({
  graph,
  disabled,
  onGenerated,
}: {
  graph: AgentGraph;
  disabled: boolean;
  onGenerated: (graph: AgentGraph) => void;
}) {
  const { workspace } = useWorkspace();
  const generate = useGenerateGraph(workspace.id);

  const [prompt, setPrompt] = useState("");
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<AgentGraph | null>(null);

  // `begin` is on every canvas from the moment it exists, so it does not count
  // as work somebody would mind losing.
  const existing = Object.keys(graph.nodes).filter((id) => id !== "begin").length;

  function run() {
    setErrors([]);
    generate.mutate(prompt.trim(), {
      onSuccess: (result) => {
        if ("errors" in result) {
          setErrors(result.errors);
          return;
        }

        const drafted = result.graph as unknown as AgentGraph;
        if (existing > 0) setPending(drafted);
        else onGenerated(drafted);
      },
    });
  }

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label className="flex items-center gap-1.5 text-xs" htmlFor="flow-prompt">
        <Sparkles className="size-3.5" />
        Draft with a prompt
      </Label>

      <Textarea
        id="flow-prompt"
        rows={3}
        placeholder="Read yesterday's email, sort it, and summarise what matters."
        value={prompt}
        disabled={disabled || generate.isPending}
        onChange={(event) => setPrompt(event.target.value)}
        className="text-sm"
      />

      <Button
        type="button"
        size="sm"
        className="w-full"
        disabled={disabled || generate.isPending || prompt.trim().length < 10}
        onClick={run}
      >
        {generate.isPending ? "Drafting..." : "Draft the flow"}
      </Button>

      {errors.length > 0 && (
        <div className="space-y-1 rounded-md border border-destructive/40 bg-destructive/5 p-2">
          <p className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <AlertCircle className="size-3.5" />
            The draft was refused
          </p>
          <ul className="space-y-0.5 text-[11px] text-muted-foreground">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        A draft lands on the canvas for you to correct. Nothing is saved until you
        publish a version.
      </p>

      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(open) => !open && setPending(null)}
        title="Replace what is on the canvas?"
        description={`The canvas has ${existing} step${existing === 1 ? "" : "s"}. The draft replaces all of them. Nothing is saved either way — publish a version to keep it, or leave without publishing to keep what you had.`}
        confirmLabel="Replace"
        destructive
        onConfirm={() => {
          if (pending) onGenerated(pending);
          setPending(null);
        }}
      />
    </div>
  );
}
