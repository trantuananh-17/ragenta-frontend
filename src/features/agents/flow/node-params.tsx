"use client";

import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  casesOf,
  categoriesOf,
  type AgentGraph,
  type CaseParam,
  type CategoryParam,
  type FlowNode,
} from "./graph-model";

/**
 * The settings of the selected node.
 *
 * One panel with a branch per type rather than eight components: each is a
 * handful of fields, and eight files that mostly render a textarea would be
 * harder to read than the switch below.
 *
 * Branch targets are chosen from the nodes that exist, never typed. A branch
 * pointing at a node nobody drew is the mistake this whole panel exists to make
 * impossible before publishing.
 */
export function NodeParams({
  graph,
  nodeId,
  node,
  toolIds,
  disabled,
  onChange,
}: {
  graph: AgentGraph;
  nodeId: string;
  node: FlowNode;
  toolIds: string[];
  disabled?: boolean;
  onChange: (params: Record<string, unknown>) => void;
}) {
  const params = node.params;
  const set = (key: string, value: unknown) => onChange({ ...params, [key]: value });

  const targets = Object.keys(graph.nodes).filter((id) => id !== nodeId);

  if (node.type === "begin") {
    return (
      <p className="text-xs text-muted-foreground">
        The entry point has nothing to configure. Everything after it can read what
        the run was asked to do as <code>{"{{begin.text}}"}</code>.
      </p>
    );
  }

  if (node.type === "llm" || node.type === "agent") {
    return (
      <div className="space-y-3">
        <Field label="System prompt (optional)">
          <Textarea
            rows={3}
            disabled={disabled}
            value={String(params.system ?? "")}
            onChange={(event) => set("system", event.target.value)}
          />
        </Field>
        <Field
          label="Prompt"
          hint="Reference another node with {{nodeId.text}}."
        >
          <Textarea
            rows={5}
            disabled={disabled}
            value={String(params.prompt ?? "")}
            onChange={(event) => set("prompt", event.target.value)}
          />
        </Field>

        {node.type === "agent" && (
          <>
            <Field label="Tools">
              <div className="space-y-1.5 rounded-md border p-2">
                {toolIds.map((tool) => {
                  const selected = (params.tools as string[] | undefined) ?? [];
                  return (
                    <label key={tool} className="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        disabled={disabled}
                        checked={selected.includes(tool)}
                        onChange={(event) =>
                          set(
                            "tools",
                            event.target.checked
                              ? [...selected, tool]
                              : selected.filter((id) => id !== tool),
                          )
                        }
                      />
                      {tool}
                    </label>
                  );
                })}
              </div>
            </Field>
            <Field label="Maximum rounds">
              <Input
                inputMode="numeric"
                disabled={disabled}
                value={String(params.maxRounds ?? 3)}
                onChange={(event) => set("maxRounds", Number(event.target.value) || 1)}
              />
            </Field>
          </>
        )}
      </div>
    );
  }

  if (node.type === "knowledge_search") {
    return (
      <div className="space-y-3">
        <Field label="Query" hint="What to search for. Templates work here too.">
          <Textarea
            rows={3}
            disabled={disabled}
            value={String(params.query ?? "")}
            onChange={(event) => set("query", event.target.value)}
          />
        </Field>
        <Field label="Passages (optional)">
          <Input
            inputMode="numeric"
            placeholder="Base default"
            disabled={disabled}
            value={params.topK === undefined ? "" : String(params.topK)}
            onChange={(event) =>
              set("topK", event.target.value === "" ? undefined : Number(event.target.value))
            }
          />
        </Field>
      </div>
    );
  }

  if (node.type === "message") {
    return (
      <Field label="Text" hint="Shown to whoever is watching the run.">
        <Textarea
          rows={5}
          disabled={disabled}
          value={String(params.text ?? "")}
          onChange={(event) => set("text", event.target.value)}
        />
      </Field>
    );
  }

  if (node.type === "user_input") {
    const fields = (params.fields as string[] | undefined) ?? [];
    return (
      <div className="space-y-3">
        <Field label="What to ask">
          <Textarea
            rows={3}
            disabled={disabled}
            value={String(params.prompt ?? "")}
            onChange={(event) => set("prompt", event.target.value)}
          />
        </Field>
        <Field label="Fields" hint="One answer box each. Read as {{nodeId.field}}.">
          <div className="space-y-1.5">
            {fields.map((field, index) => (
              <div key={index} className="flex gap-1.5">
                <Input
                  disabled={disabled}
                  value={field}
                  onChange={(event) =>
                    set(
                      "fields",
                      fields.map((entry, position) =>
                        position === index ? event.target.value : entry,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  disabled={disabled || fields.length === 1}
                  onClick={() =>
                    set("fields", fields.filter((_, position) => position !== index))
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || fields.length >= 6}
              onClick={() => set("fields", [...fields, `field_${fields.length + 1}`])}
            >
              Add field
            </Button>
          </div>
        </Field>
      </div>
    );
  }

  const text = (key: string, fallback = "") =>
    typeof params[key] === "string" ? (params[key] as string) : fallback;

  if (node.type === "ocr" || node.type === "stt") {
    return (
      <div className="space-y-3">
        <Field
          label="Attachment"
          hint="The id of an uploaded file, usually from an earlier step's output."
        >
          <Input
            value={text("attachmentId")}
            disabled={disabled}
            onChange={(event) => set("attachmentId", event.target.value)}
          />
        </Field>
        {node.type === "stt" && (
          <Field label="Language (optional)" hint="Two letters, e.g. vi. Detected when blank.">
            <Input
              value={text("language")}
              disabled={disabled}
              maxLength={2}
              placeholder="vi"
              onChange={(event) => set("language", event.target.value.trim() || undefined)}
            />
          </Field>
        )}
      </div>
    );
  }

  if (node.type === "vision") {
    return (
      <div className="space-y-3">
        <Field label="Attachment">
          <Input
            value={text("attachmentId")}
            disabled={disabled}
            onChange={(event) => set("attachmentId", event.target.value)}
          />
        </Field>
        <Field label="Question">
          <Textarea
            rows={3}
            value={text("question")}
            disabled={disabled}
            onChange={(event) => set("question", event.target.value)}
          />
        </Field>
      </div>
    );
  }

  if (node.type === "tts") {
    return (
      <div className="space-y-3">
        <Field label="Text to speak">
          <Textarea
            rows={3}
            value={text("text")}
            disabled={disabled}
            onChange={(event) => set("text", event.target.value)}
          />
        </Field>
        <Field
          label="Voice (optional)"
          hint="Voice ids belong to the speech service. Blank uses the deployment default."
        >
          <Input
            value={text("voice")}
            disabled={disabled}
            onChange={(event) => set("voice", event.target.value.trim() || undefined)}
          />
        </Field>
      </div>
    );
  }

  if (node.type === "http" || node.type === "browser") {
    const method = text("method", "GET");
    return (
      <div className="space-y-3">
        <Field
          label="URL"
          hint="Private and link-local addresses are refused by the server, whatever is typed here."
        >
          <Input
            value={text("url")}
            disabled={disabled}
            placeholder="https://"
            onChange={(event) => set("url", event.target.value)}
          />
        </Field>
        {node.type === "http" && (
          <>
            <Field label="Method">
              <Select
                value={method}
                disabled={disabled}
                onValueChange={(value) => set("method", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GET">GET</SelectItem>
                  <SelectItem value="POST">POST</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {method === "POST" && (
              <Field label="Body">
                <Textarea
                  rows={3}
                  value={text("body")}
                  disabled={disabled}
                  onChange={(event) => set("body", event.target.value)}
                />
              </Field>
            )}
          </>
        )}
      </div>
    );
  }

  if (node.type === "excel") {
    const operation = text("operation", "read");
    return (
      <div className="space-y-3">
        <Field label="Operation">
          <Select
            value={operation}
            disabled={disabled}
            onValueChange={(value) =>
              // The two operations take different fields, so switching resets to
              // that operation's own defaults rather than carrying the other's
              // over and failing validation on a field the form no longer shows.
              onChange(
                value === "read"
                  ? { operation: "read", attachmentId: "" }
                  : { operation: "write", sheets: [{ name: "Sheet1", rows: [[""]] }] },
              )
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="read">Read a workbook</SelectItem>
              <SelectItem value="write">Write a workbook</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        {operation === "read" ? (
          <>
            <Field label="Attachment">
              <Input
                value={text("attachmentId")}
                disabled={disabled}
                onChange={(event) => set("attachmentId", event.target.value)}
              />
            </Field>
            <Field label="Sheet (optional)" hint="Blank reads every sheet.">
              <Input
                value={text("sheet")}
                disabled={disabled}
                onChange={(event) => set("sheet", event.target.value.trim() || undefined)}
              />
            </Field>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            The rows a write step produces are normally built by an earlier model or
            agent step. Point that step at this one and reference its output.
          </p>
        )}
      </div>
    );
  }

  if (node.type === "loop") {
    return (
      <div className="space-y-3">
        <Field label="List" hint="A template producing the items, e.g. an earlier step's text.">
          <Input
            value={text("items")}
            disabled={disabled}
            onChange={(event) => set("items", event.target.value)}
          />
        </Field>
        <Field label="Format">
          <Select
            value={text("format", "lines")}
            disabled={disabled}
            onValueChange={(value) => set("format", value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lines">One item per line</SelectItem>
              <SelectItem value="json">A JSON array</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field
          label="Step to repeat"
          hint="Exactly one step, and it must lead nowhere else. Its only way in is this loop."
        >
          <TargetPicker
            targets={targets}
            value={text("body")}
            disabled={disabled}
            onChange={(value) => set("body", value)}
          />
        </Field>
        <Field
          label="Most iterations"
          hint="Capped at 25, and by whatever the run can still afford."
        >
          <Input
            type="number"
            min={1}
            max={25}
            value={typeof params.maxIterations === "number" ? params.maxIterations : 10}
            disabled={disabled}
            onChange={(event) => set("maxIterations", Number(event.target.value))}
          />
        </Field>
      </div>
    );
  }

  if (node.type === "categorize") {
    const categories: CategoryParam[] = categoriesOf(node);
    return (
      <div className="space-y-3">
        <Field label="What to classify">
          <Textarea
            rows={3}
            disabled={disabled}
            value={String(params.input ?? "")}
            onChange={(event) => set("input", event.target.value)}
          />
        </Field>
        <Field label="Categories" hint="The model picks exactly one and that branch runs.">
          <div className="space-y-2">
            {categories.map((category, index) => (
              <div key={index} className="space-y-1.5 rounded-md border p-2">
                <Input
                  placeholder="Name"
                  disabled={disabled}
                  value={category.name}
                  onChange={(event) =>
                    set(
                      "categories",
                      categories.map((entry, position) =>
                        position === index ? { ...entry, name: event.target.value } : entry,
                      ),
                    )
                  }
                />
                <Input
                  placeholder="When to choose it"
                  disabled={disabled}
                  value={category.description}
                  onChange={(event) =>
                    set(
                      "categories",
                      categories.map((entry, position) =>
                        position === index
                          ? { ...entry, description: event.target.value }
                          : entry,
                      ),
                    )
                  }
                />
                <TargetPicker
                  targets={targets}
                  value={category.to}
                  disabled={disabled}
                  onChange={(next) =>
                    set(
                      "categories",
                      categories.map((entry, position) =>
                        position === index ? { ...entry, to: next } : entry,
                      ),
                    )
                  }
                />
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || categories.length >= 8}
              onClick={() =>
                set("categories", [
                  ...categories,
                  { name: `category_${categories.length + 1}`, description: "", to: "" },
                ])
              }
            >
              Add category
            </Button>
          </div>
        </Field>
      </div>
    );
  }

  const cases: CaseParam[] = casesOf(node);

  return (
    <Field label="Conditions" hint="Checked in order. The first match wins.">
      <div className="space-y-2">
        {cases.map((branch, index) => (
          <div key={index} className="space-y-1.5 rounded-md border p-2">
            <Input
              placeholder="Value, e.g. {{classify.text}}"
              disabled={disabled}
              value={branch.left}
              onChange={(event) =>
                set(
                  "cases",
                  cases.map((entry, position) =>
                    position === index ? { ...entry, left: event.target.value } : entry,
                  ),
                )
              }
            />
            <Select
              value={branch.operator}
              disabled={disabled}
              onValueChange={(next) =>
                set(
                  "cases",
                  cases.map((entry, position) =>
                    position === index ? { ...entry, operator: next } : entry,
                  ),
                )
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equals">is</SelectItem>
                <SelectItem value="not_equals">is not</SelectItem>
                <SelectItem value="contains">contains</SelectItem>
                <SelectItem value="empty">is empty</SelectItem>
                <SelectItem value="not_empty">is not empty</SelectItem>
              </SelectContent>
            </Select>
            {branch.operator !== "empty" && branch.operator !== "not_empty" && (
              <Input
                placeholder="Compare with"
                disabled={disabled}
                value={branch.right}
                onChange={(event) =>
                  set(
                    "cases",
                    cases.map((entry, position) =>
                      position === index ? { ...entry, right: event.target.value } : entry,
                    ),
                  )
                }
              />
            )}
            <TargetPicker
              targets={targets}
              value={branch.to}
              disabled={disabled}
              onChange={(next) =>
                set(
                  "cases",
                  cases.map((entry, position) =>
                    position === index ? { ...entry, to: next } : entry,
                  ),
                )
              }
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || cases.length >= 8}
          onClick={() =>
            set("cases", [
              ...cases,
              { left: "", operator: "contains", right: "", to: "" },
            ])
          }
        >
          Add condition
        </Button>
      </div>
    </Field>
  );
}

function TargetPicker({
  targets,
  value,
  disabled,
  onChange,
}: {
  targets: string[];
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <Select value={value || undefined} disabled={disabled} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Then go to…" />
      </SelectTrigger>
      <SelectContent>
        {targets.map((target) => (
          <SelectItem key={target} value={target}>
            {target}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
