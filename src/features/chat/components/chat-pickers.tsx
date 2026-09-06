"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, Cpu } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { knowledgeOptions } from "@/features/knowledge/options/knowledge.options";
import { useModelCatalogue } from "@/features/models/hooks/models.hook";
import { modelKey, parseModelKey } from "@/features/models/service/models.service";
import type { ModelSelection } from "@/features/models/service/models.service";
import { useWorkspaceId } from "@/features/workspace/components/workspace-provider";

/** The value the selects use for "nothing chosen" — Radix rejects an empty one. */
export const NONE = "__none__";

/**
 * Which knowledge base an answer is grounded in. "No retrieval" is a real
 * choice, not an absence: it is a plain model call, and the answer then carries
 * no citations because there is nothing to cite.
 */
export function KnowledgeBasePicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (baseId: string | null) => void;
  disabled?: boolean;
}) {
  const workspaceId = useWorkspaceId();
  const { data } = useQuery(knowledgeOptions.bases(workspaceId));

  return (
    <Select
      value={value ?? NONE}
      disabled={disabled}
      onValueChange={(next) => onChange(next === NONE ? null : next)}
    >
      <SelectTrigger size="sm" className="h-7 gap-1.5 border-dashed text-xs">
        <BookOpen className="size-3.5 text-muted-foreground" />
        <SelectValue placeholder="Knowledge base" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No retrieval</SelectItem>
        {data?.items.map((base) => (
          <SelectItem key={base.id} value={base.id}>
            {base.name}
            <span className="ml-1 text-muted-foreground tabular-nums">
              ({base.documentCount})
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * A per-turn model override. Only models this workspace may actually run are
 * offered — a model whose provider has no key, or whose tier is outside the
 * plan, would be refused by the backend, so offering it would be a trap.
 */
export function ModelPicker({
  value,
  onChange,
  disabled,
}: {
  value: ModelSelection | null;
  onChange: (selection: ModelSelection | null) => void;
  disabled?: boolean;
}) {
  const workspaceId = useWorkspaceId();
  const { data } = useModelCatalogue(workspaceId);

  const chatModels =
    data?.models.filter(
      (model) => model.capability === "chat" && model.selectable,
    ) ?? [];

  return (
    <Select
      value={value ? modelKey(value) : NONE}
      disabled={disabled}
      onValueChange={(next) =>
        onChange(next === NONE ? null : parseModelKey(next))
      }
    >
      <SelectTrigger size="sm" className="h-7 gap-1.5 border-dashed text-xs">
        <Cpu className="size-3.5 text-muted-foreground" />
        <SelectValue placeholder="Model" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Workspace default</SelectItem>
        {chatModels.map((model) => (
          <SelectItem key={modelKey(model)} value={modelKey(model)}>
            {model.model}
            <span className="ml-1 text-muted-foreground">{model.provider}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
