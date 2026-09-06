"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, FolderKanban, SlidersHorizontal } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { knowledgeOptions } from "@/features/knowledge/options/knowledge.options";
import { projectsOptions } from "@/features/projects/options/projects.options";
import { useWorkspaceId } from "@/features/workspace/components/workspace-provider";
import { SEARCH_MODES, type SearchMode } from "../service/chat.service";
import { NONE } from "./chat-pickers";

/**
 * Which project this thread belongs to.
 *
 * A project is not where documents live — knowledge bases belong to the
 * workspace (ADR-019). It is what the thread's spend is attributed to, and whose
 * chat-model override applies. Both are invisible without this control, which is
 * why every conversation started before it existed is attributed to nothing.
 */
export function ProjectPicker({
  value,
  onChange,
  disabled,
}: {
  value: string | null;
  onChange: (projectId: string | null) => void;
  disabled?: boolean;
}) {
  const workspaceId = useWorkspaceId();
  const { data } = useQuery(projectsOptions.list(workspaceId));

  // A workspace with no projects has nothing to attribute to, and a select whose
  // only option is "none" is a control that can only ever say no.
  const projects = data ?? [];
  if (projects.length === 0) return null;

  return (
    <Select
      value={value ?? NONE}
      disabled={disabled}
      onValueChange={(next) => onChange(next === NONE ? null : next)}
    >
      <SelectTrigger size="sm" className="h-7 gap-1.5 border-dashed text-xs">
        <FolderKanban className="size-3.5 text-muted-foreground" />
        <SelectValue placeholder="Project" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No project</SelectItem>
        {projects.map((project) => (
          <SelectItem key={project.id} value={project.id}>
            {project.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Narrows retrieval to specific files.
 *
 * "Answer from this contract, not from the other forty" is a question people ask
 * constantly, and without this it can only be expressed by building a second
 * knowledge base. Nothing selected means every document, which is the common
 * case and therefore the default.
 */
export function DocumentScopePicker({
  knowledgeBaseId,
  value,
  onChange,
  disabled,
}: {
  knowledgeBaseId: string | null;
  value: string[];
  onChange: (documentIds: string[]) => void;
  disabled?: boolean;
}) {
  const workspaceId = useWorkspaceId();
  const { data } = useQuery({
    ...knowledgeOptions.documents(workspaceId, knowledgeBaseId ?? ""),
    enabled: knowledgeBaseId !== null,
  });

  if (!knowledgeBaseId) return null;

  // Only documents retrieval can actually return something from. Offering one
  // that is still embedding would scope an answer to a file with no passages.
  const ready = data?.items.filter((document) => document.status === "ready") ?? [];
  if (ready.length === 0) return null;

  const toggle = (documentId: string) => {
    onChange(
      value.includes(documentId)
        ? value.filter((id) => id !== documentId)
        : [...value, documentId],
    );
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-7 gap-1.5 border-dashed px-2 text-xs font-normal"
        >
          <FileText className="size-3.5 text-muted-foreground" />
          {value.length === 0 ? "All files" : `${value.length} files`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="text-xs font-medium">Search only these files</span>
          {value.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => onChange([])}
            >
              Clear
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-64">
          <div className="space-y-1 p-2">
            {ready.map((document) => (
              <Label
                key={document.id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs font-normal hover:bg-accent"
              >
                <Checkbox
                  checked={value.includes(document.id)}
                  onCheckedChange={() => toggle(document.id)}
                />
                <span className="truncate">{document.name}</span>
              </Label>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

const MODE_LABELS: Record<SearchMode, { name: string; hint: string }> = {
  hybrid: {
    name: "Hybrid",
    hint: "Meaning and wording together. The right default for questions asked in prose.",
  },
  vector: {
    name: "Meaning",
    hint: "Ignores wording. Best when the question and the document say the same thing in different words.",
  },
  keyword: {
    name: "Exact words",
    hint: "Best for a part number, an error code or a name — the things meaning-based search is worst at.",
  },
};

/**
 * How the passages behind an answer are found, and how many.
 *
 * These were constants in the backend until now, which meant a knowledge base of
 * error codes and one of policy documents were searched identically. They sit
 * behind a popover rather than on the toolbar because changing them is
 * occasional and the defaults are right most of the time.
 */
export function RetrievalSettingsPicker({
  mode,
  topK,
  onChange,
  disabled,
}: {
  mode: SearchMode;
  /** Null inherits the knowledge base's own setting. */
  topK: number | null;
  onChange: (settings: { mode?: SearchMode; topK?: number | null }) => void;
  disabled?: boolean;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={disabled}
          className="h-7 gap-1.5 border-dashed px-2 text-xs font-normal"
        >
          <SlidersHorizontal className="size-3.5 text-muted-foreground" />
          {MODE_LABELS[mode].name}
          {topK !== null && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px] tabular-nums">
              {topK}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-4">
        <div className="space-y-2">
          <Label className="text-xs">How to search</Label>
          <div className="space-y-1">
            {SEARCH_MODES.map((option) => (
              <Label
                key={option}
                className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs font-normal hover:bg-accent"
              >
                <input
                  type="radio"
                  name="search-mode"
                  className="mt-0.5"
                  checked={mode === option}
                  onChange={() => onChange({ mode: option })}
                />
                <span>
                  <span className="font-medium">{MODE_LABELS[option].name}</span>
                  <span className="block text-muted-foreground">
                    {MODE_LABELS[option].hint}
                  </span>
                </span>
              </Label>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="topK" className="text-xs">
            Passages per answer
          </Label>
          <Select
            value={topK === null ? NONE : String(topK)}
            onValueChange={(next) =>
              onChange({ topK: next === NONE ? null : Number(next) })
            }
          >
            <SelectTrigger id="topK" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Knowledge base default</SelectItem>
              {[3, 6, 10, 15, 20].map((count) => (
                <SelectItem key={count} value={String(count)}>
                  {count}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            More passages give the model more to work with and cost more per
            turn, because every one of them goes into the prompt.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
