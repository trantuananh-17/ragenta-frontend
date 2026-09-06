"use client";

import { useMemo } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { knowledgeOptions } from "@/features/knowledge/options/knowledge.options";
import { useModelCatalogue } from "@/features/models/hooks/models.hook";
import {
  modelKey,
  parseModelKey,
} from "@/features/models/service/models.service";
import { useQuery } from "@tanstack/react-query";
import type {
  AgentConfigInput,
  AgentVersion,
  SearchMode,
} from "../service/agents.service";

/** Inherit the project override, then the workspace default. */
const INHERIT = "__inherit__";

const schema = z.object({
  instructions: z.string().trim().min(1, "An agent needs a brief.").max(20_000),
  model: z.string(),
  temperature: z.string(),
  maxOutputTokens: z.string(),
  knowledgeBaseIds: z.array(z.string()).max(10),
  searchMode: z.enum(["hybrid", "vector", "keyword"]),
  topK: z.string(),
  groundedOnly: z.boolean(),
});

type FormValues = z.infer<typeof schema>;

/**
 * An optional number, as a form field.
 *
 * Empty means "inherit", which is a different thing from zero, so the field is
 * kept as a string and converted here — a coerced number field would turn a
 * cleared box into 0 and silently pin the setting to a value nobody chose.
 */
function optionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

function defaultsFrom(version: AgentVersion | null | undefined): FormValues {
  return {
    instructions: version?.instructions ?? "",
    model:
      version?.provider && version.model
        ? modelKey({ provider: version.provider, model: version.model })
        : INHERIT,
    temperature: version?.temperature === null || version?.temperature === undefined
      ? ""
      : String(version.temperature),
    maxOutputTokens:
      version?.maxOutputTokens === null || version?.maxOutputTokens === undefined
        ? ""
        : String(version.maxOutputTokens),
    knowledgeBaseIds: version?.knowledgeBaseIds ?? [],
    searchMode: (version?.searchMode as SearchMode) ?? "hybrid",
    topK: version?.topK === null || version?.topK === undefined ? "" : String(version.topK),
    groundedOnly: version?.groundedOnly ?? true,
  };
}

/**
 * The editor for one version.
 *
 * Saving publishes a **new** version rather than editing the current one, which
 * the button says out loud: a run records the version it ran, and edits that
 * rewrote history would make an answer from last month unexplainable.
 */
export function AgentConfigForm({
  workspaceId,
  version,
  disabled,
  pending,
  submitLabel,
  onSubmit,
}: {
  workspaceId: string;
  version?: AgentVersion | null;
  disabled?: boolean;
  pending?: boolean;
  submitLabel: string;
  onSubmit: (config: AgentConfigInput) => void;
}) {
  const { data: catalogue } = useModelCatalogue(workspaceId);
  const { data: bases } = useQuery(knowledgeOptions.bases(workspaceId));

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultsFrom(version),
  });

  const chatModels = useMemo(
    () =>
      (catalogue?.models ?? []).filter(
        (entry) => entry.capability === "chat" && entry.selectable,
      ),
    [catalogue],
  );

  // `useWatch` rather than `form.watch`: the latter returns a fresh function
  // the React Compiler cannot memoize, which opts the whole form out of it.
  const control = form.control;
  const selectedBases = useWatch({ control, name: "knowledgeBaseIds" });
  const selectedModel = useWatch({ control, name: "model" });
  const selectedSearchMode = useWatch({ control, name: "searchMode" });
  const groundedOnly = useWatch({ control, name: "groundedOnly" });
  const grounded = selectedBases.length > 0;

  const submit = form.handleSubmit((values) => {
    onSubmit({
      instructions: values.instructions,
      model: values.model === INHERIT ? null : parseModelKey(values.model),
      temperature: optionalNumber(values.temperature),
      maxOutputTokens: optionalNumber(values.maxOutputTokens),
      knowledgeBaseIds: values.knowledgeBaseIds,
      searchMode: values.searchMode,
      topK: optionalNumber(values.topK),
      groundedOnly: values.groundedOnly,
    });
  });

  return (
    <form onSubmit={submit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="instructions">Instructions</Label>
        <Textarea
          id="instructions"
          rows={8}
          disabled={disabled}
          placeholder="What this agent is for, and how it should answer."
          {...form.register("instructions")}
        />
        <p className="text-xs text-muted-foreground">
          The brief is added after the platform&apos;s own rules, so it sets the task
          but cannot switch off citations or grounding.
        </p>
        {form.formState.errors.instructions && (
          <p className="text-xs text-destructive">
            {form.formState.errors.instructions.message}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2 sm:col-span-3">
          <Label>Model</Label>
          <Select
            value={selectedModel}
            disabled={disabled}
            onValueChange={(next) => form.setValue("model", next)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={INHERIT}>Workspace default</SelectItem>
              {chatModels.map((entry) => (
                <SelectItem key={modelKey(entry)} value={modelKey(entry)}>
                  {entry.model}
                  <span className="ml-1 text-muted-foreground">({entry.provider})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="temperature">Temperature</Label>
          <Input
            id="temperature"
            inputMode="decimal"
            placeholder="Provider default"
            disabled={disabled}
            {...form.register("temperature")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxOutputTokens">Max output tokens</Label>
          <Input
            id="maxOutputTokens"
            inputMode="numeric"
            placeholder="2000"
            disabled={disabled}
            {...form.register("maxOutputTokens")}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="topK">Passages</Label>
          <Input
            id="topK"
            inputMode="numeric"
            placeholder="Base default"
            disabled={disabled || !grounded}
            {...form.register("topK")}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Knowledge bases</Label>
        {bases?.items.length ? (
          <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
            {bases.items.map((base) => (
              <label
                key={base.id}
                className="flex items-center gap-2 text-sm"
                htmlFor={`base-${base.id}`}
              >
                <Checkbox
                  id={`base-${base.id}`}
                  disabled={disabled}
                  checked={selectedBases.includes(base.id)}
                  onCheckedChange={(checked) =>
                    form.setValue(
                      "knowledgeBaseIds",
                      checked
                        ? [...selectedBases, base.id]
                        : selectedBases.filter((id) => id !== base.id),
                    )
                  }
                />
                <span className="truncate">{base.name}</span>
              </label>
            ))}
          </div>
        ) : (
          <p className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
            This workspace has no knowledge bases. The agent will answer from the
            model alone, without citations.
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          All of them must share an embedding model — passages from two models
          cannot be ranked against each other, and publishing is refused if they
          differ.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Search mode</Label>
          <Select
            value={selectedSearchMode}
            disabled={disabled || !grounded}
            onValueChange={(next) => form.setValue("searchMode", next as SearchMode)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="vector">Vector only</SelectItem>
              <SelectItem value="keyword">Keyword only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div className="space-y-0.5">
            <Label htmlFor="groundedOnly">Answer only from documents</Label>
            <p className="text-xs text-muted-foreground">
              Off lets the agent fall back to what the model knows.
            </p>
          </div>
          <Switch
            id="groundedOnly"
            disabled={disabled || !grounded}
            checked={groundedOnly}
            onCheckedChange={(checked) => form.setValue("groundedOnly", checked)}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={disabled || pending}>
          {pending ? "Publishing…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
