"use client";

import { useState } from "react";
import { Play, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWorkspaceId } from "@/features/workspace/components/workspace-provider";
import { useDryRun, useGenerateQuery, useSaveQuery } from "../hooks/data-sources.hook";
import type { DataQueryParameter, DataSource, DryRunResult } from "../service/data-sources.service";

/**
 * Where a question the agent may ask gets written and approved.
 *
 * The order of the screen **is** the security design (ADR-064). A model can
 * propose SQL, but nothing it proposes is callable until somebody has run it
 * against real data and seen the rows. So the approve button does not exist
 * until the query has been run, and that is deliberate rather than a nicety:
 * approving a statement nobody has seen the output of is approving a sentence,
 * not a query.
 */
export function QueryBuilder({
  source,
  onDone,
}: {
  source: DataSource;
  onDone: () => void;
}) {
  const [description, setDescription] = useState("");
  const [name, setName] = useState("");
  const [purpose, setPurpose] = useState("");
  const [sql, setSql] = useState("");
  const [parameters, setParameters] = useState<DataQueryParameter[]>([]);
  const [sampleValues, setSampleValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<DryRunResult | null>(null);
  /** `generated` until a person has edited the statement themselves. */
  const [origin, setOrigin] = useState<"manual" | "generated">("manual");

  const workspaceId = useWorkspaceId();
  const propose = useGenerateQuery(workspaceId);
  const run = useDryRun(workspaceId);
  const save = useSaveQuery(workspaceId);

  const ready = name.trim() && purpose.trim() && sql.trim();
  const approved = result !== null;

  return (
    <div className="space-y-6 rounded-md border p-4">
      <section className="space-y-2">
        <Label htmlFor="query-description">
          Describe what you want the agent to be able to look up
        </Label>
        <div className="flex gap-2">
          <Input
            id="query-description"
            value={description}
            placeholder="Let a customer check the status of an order by its number"
            onChange={(event) => setDescription(event.target.value)}
          />
          <Button
            variant="outline"
            disabled={description.trim().length < 5 || propose.isPending}
            onClick={() =>
              propose.mutate(
                { dataSourceId: source.id, description: description.trim() },
                {
                  onSuccess: (proposal) => {
                    setName(proposal.name);
                    setPurpose(proposal.description);
                    setSql(proposal.sql);
                    setParameters(proposal.parameters);
                    setSampleValues({});
                    // A fresh proposal has not been run, so it is not approvable.
                    setResult(null);
                    setOrigin("generated");
                  },
                },
              )
            }
          >
            <Sparkles className="size-4" />
            {propose.isPending ? "Writing..." : "Write it for me"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Ragenta reads the table and column names — never your data — and writes a statement you
          can read and change. Nothing is saved until you approve it.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="query-name">Name the agent will use</Label>
          <Input
            id="query-name"
            value={name}
            placeholder="order_status"
            onChange={(event) => setName(event.target.value)}
            className="font-mono text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="query-purpose">What it answers</Label>
          <Input
            id="query-purpose"
            value={purpose}
            placeholder="The status and shipping date of one order"
            onChange={(event) => setPurpose(event.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            This is all the agent is told about it, so a vague sentence gets it called wrongly.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="query-sql">SQL</Label>
        <Textarea
          id="query-sql"
          value={sql}
          rows={5}
          placeholder={
            source.engine === "postgres"
              ? "SELECT status, shipped_at FROM orders WHERE id = $1"
              : "SELECT status, shipped_at FROM orders WHERE id = ?"
          }
          onChange={(event) => {
            setSql(event.target.value);
            // An edited statement has not been run in the form it is now in.
            setResult(null);
            setOrigin("manual");
          }}
          className="font-mono text-xs"
        />
        <p className="text-xs text-muted-foreground">
          Read only — the connection runs it in a read-only transaction, so a write is refused by
          the database itself. Use{" "}
          <code className="font-mono">{source.engine === "postgres" ? "$1, $2" : "?"}</code> for
          anything the agent supplies; values are never pasted into the statement.
        </p>
      </div>

      {parameters.length > 0 && (
        <section className="space-y-2">
          <Label>Try it with real values</Label>
          <div className="grid gap-3 md:grid-cols-2">
            {parameters.map((parameter) => (
              <div key={parameter.name} className="space-y-1">
                <Label htmlFor={`p-${parameter.name}`} className="font-mono text-xs">
                  {parameter.name}
                </Label>
                <Input
                  id={`p-${parameter.name}`}
                  value={sampleValues[parameter.name] ?? ""}
                  placeholder={parameter.description || parameter.type}
                  onChange={(event) =>
                    setSampleValues((current) => ({
                      ...current,
                      [parameter.name]: event.target.value,
                    }))
                  }
                />
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          disabled={!sql.trim() || run.isPending}
          onClick={() =>
            run.mutate(
              {
                dataSourceId: source.id,
                sql: sql.trim(),
                parameters: parameters.map((parameter) => sampleValues[parameter.name] ?? ""),
                rowLimit: 20,
              },
              { onSuccess: setResult },
            )
          }
        >
          <Play className="size-4" />
          {run.isPending ? "Running..." : "Run it once"}
        </Button>

        <Button
          disabled={!ready || !approved || save.isPending}
          onClick={() =>
            save.mutate(
              {
                dataSourceId: source.id,
                name: name.trim(),
                description: purpose.trim(),
                sql: sql.trim(),
                parameters,
                rowLimit: 50,
                origin,
                // Only ever sent after a run, which is what the disabled button
                // above enforces.
                approve: true,
              },
              { onSuccess: onDone },
            )
          }
        >
          {save.isPending ? "Saving..." : "Approve and save"}
        </Button>

        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>

        {!approved && (
          <p className="text-xs text-muted-foreground">
            Run it first. An agent should not be given a question nobody has seen the answer to.
          </p>
        )}
      </div>

      {result && (
        <section className="space-y-2">
          <p className="text-xs text-muted-foreground">
            {result.rows.length} {result.rows.length === 1 ? "row" : "rows"} in{" "}
            {result.durationMs}ms{result.truncated ? " (more exist)" : ""}. This is what the agent
            will read.
          </p>
          <div className="max-h-64 overflow-auto rounded border">
            <Table>
              <TableHeader>
                <TableRow>
                  {result.columns.map((column) => (
                    <TableHead key={column} className="font-mono text-xs">
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((row, index) => (
                  // The index is the key because a result row has no id of its
                  // own and the table is read-only and never reordered.
                  <TableRow key={index}>
                    {row.map((cell, cellIndex) => (
                      <TableCell key={cellIndex} className="font-mono text-xs">
                        {cell === null || cell === undefined ? "" : String(cell)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {result.rows.length === 0 && (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              It ran but matched nothing. That may be right, or the sample value may not exist —
              worth checking before approving.
            </p>
          )}
        </section>
      )}
    </div>
  );
}
