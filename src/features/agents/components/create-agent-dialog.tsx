"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { knowledgeOptions } from "@/features/knowledge/options/knowledge.options";
import {
  useAgentTemplates,
  useCreateAgent,
  useCreateFromTemplate,
} from "../hooks/agents.hook";
import type { AgentTemplate } from "../service/agents.service";

/**
 * Where an agent starts.
 *
 * Two ways in, and the templates come first because the empty box is the harder
 * one: a brief written from nothing is usually a brief that says what to do and
 * never what to refuse. Whichever way, the agent is created as a **draft** —
 * model, retrieval and tools are on the detail screen, because asking for ten
 * settings before the thing exists is a long form in front of a decision nobody
 * has made yet.
 */
export function CreateAgentDialog({
  workspaceId,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [chosen, setChosen] = useState<AgentTemplate | "blank" | null>(null);

  const close = () => {
    setChosen(null);
    onOpenChange(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setChosen(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        {chosen === null ? (
          <TemplateGallery workspaceId={workspaceId} onChoose={setChosen} />
        ) : chosen === "blank" ? (
          <BlankForm
            workspaceId={workspaceId}
            onBack={() => setChosen(null)}
            onCancel={close}
          />
        ) : (
          <TemplateForm
            workspaceId={workspaceId}
            template={chosen}
            onBack={() => setChosen(null)}
            onCancel={close}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function TemplateGallery({
  workspaceId,
  onChoose,
}: {
  workspaceId: string;
  onChoose: (choice: AgentTemplate | "blank") => void;
}) {
  const { data: templates, isPending } = useAgentTemplates(workspaceId);

  return (
    <>
      <DialogHeader>
        <DialogTitle>New agent</DialogTitle>
        <DialogDescription>
          Start from one of these and edit it, or from nothing. Either way it is a
          draft until you activate it.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2 py-2">
        {isPending && (
          <p className="text-sm text-muted-foreground">Loading templates…</p>
        )}

        {templates?.map((template) => {
          const missing = template.tools.filter((tool) => !tool.available);
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onChoose(template)}
              className="w-full rounded-lg border p-3 text-left transition-colors hover:bg-accent"
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="size-4 text-muted-foreground" />
                {template.name}
              </span>
              <span className="mt-1 block text-xs text-muted-foreground">
                {template.summary}
              </span>
              {missing.length > 0 && (
                <span className="mt-1 block text-xs text-amber-700 dark:text-amber-400">
                  {missing.map((tool) => tool.title).join(", ")} not available here —
                  it will be created without{" "}
                  {missing.length === 1 ? "that tool" : "those tools"}.
                </span>
              )}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onChoose("blank")}
          className="w-full rounded-lg border border-dashed p-3 text-left transition-colors hover:bg-accent"
        >
          <span className="text-sm font-medium">Start from nothing</span>
          <span className="mt-1 block text-xs text-muted-foreground">
            A name and a brief you write yourself.
          </span>
        </button>
      </div>
    </>
  );
}

function TemplateForm({
  workspaceId,
  template,
  onBack,
  onCancel,
}: {
  workspaceId: string;
  template: AgentTemplate;
  onBack: () => void;
  onCancel: () => void;
}) {
  const create = useCreateFromTemplate(workspaceId);
  const { data: bases } = useQuery(knowledgeOptions.bases(workspaceId));

  const [name, setName] = useState(template.name);
  const [baseIds, setBaseIds] = useState<string[]>([]);

  const needsBase = template.needsKnowledgeBase && baseIds.length === 0;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || needsBase) return;
    create.mutate({
      templateId: template.id,
      name: name.trim(),
      projectId: null,
      knowledgeBaseIds: baseIds,
    });
  };

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>{template.name}</DialogTitle>
        <DialogDescription>{template.description}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="template-name">Name</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </div>

        <div className="space-y-2">
          <Label>Knowledge bases</Label>
          {bases?.items.length ? (
            <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
              {bases.items.map((base) => (
                <label
                  key={base.id}
                  htmlFor={`template-base-${base.id}`}
                  className="flex items-center gap-2 text-sm"
                >
                  <Checkbox
                    id={`template-base-${base.id}`}
                    checked={baseIds.includes(base.id)}
                    onCheckedChange={(checked) =>
                      setBaseIds((current) =>
                        checked
                          ? [...current, base.id]
                          : current.filter((id) => id !== base.id),
                      )
                    }
                  />
                  <span className="truncate">{base.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
              This workspace has no knowledge bases yet.
            </p>
          )}
          {template.needsKnowledgeBase && (
            <p className="text-xs text-muted-foreground">
              This one answers from documents, so it needs at least one — without a
              base its every answer would be that it could not find anything.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <Label>Tools it comes with</Label>
          <ul className="space-y-1 rounded-lg border p-3 text-sm">
            {template.tools.map((tool) => (
              <li key={tool.id} className="flex items-center justify-between gap-2">
                <span>{tool.title}</span>
                {tool.available ? (
                  <span className="text-xs text-muted-foreground">included</span>
                ) : (
                  <span className="text-xs text-amber-700 dark:text-amber-400">
                    needs the {tool.requires} connection — dropped
                  </span>
                )}
              </li>
            ))}
            {template.tools.length === 0 && (
              <li className="text-muted-foreground">None.</li>
            )}
          </ul>
        </div>

        <div className="space-y-2">
          <Label htmlFor="template-brief">Brief</Label>
          <Textarea
            id="template-brief"
            rows={6}
            value={template.instructions}
            readOnly
            className="text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Written to be argued with. Edit it on the agent&apos;s Configuration tab
            once it exists.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={create.isPending || !name.trim() || needsBase}>
          {create.isPending ? "Creating…" : "Create agent"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function BlankForm({
  workspaceId,
  onBack,
  onCancel,
}: {
  workspaceId: string;
  onBack: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const create = useCreateAgent(workspaceId);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !instructions.trim()) return;
    create.mutate({
      name: name.trim(),
      description: null,
      projectId: null,
      config: { instructions: instructions.trim() },
    });
  };

  return (
    <form onSubmit={submit}>
      <DialogHeader>
        <DialogTitle>New agent</DialogTitle>
        <DialogDescription>
          It starts as a draft. Choose its model and knowledge bases next, then
          activate it.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-4">
        <div className="space-y-2">
          <Label htmlFor="agent-name">Name</Label>
          <Input
            id="agent-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Support triage"
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="agent-instructions">Instructions</Label>
          <Textarea
            id="agent-instructions"
            rows={5}
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder="What this agent is for, how it should answer, and what it should refuse."
          />
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={create.isPending || !name.trim() || !instructions.trim()}
        >
          {create.isPending ? "Creating…" : "Create agent"}
        </Button>
      </DialogFooter>
    </form>
  );
}
