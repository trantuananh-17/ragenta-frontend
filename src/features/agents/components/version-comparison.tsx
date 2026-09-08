"use client";

import { useState } from "react";
import { Play } from "lucide-react";

import { DetailSection } from "@/components/detail-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatCredits } from "@/lib/format";
import { useComparison, useCompareVersions } from "../hooks/agents.hook";
import type { AgentVersion, ComparisonRun } from "../service/agents.service";

/**
 * One question, asked of several versions.
 *
 * The point of the screen is that the answers sit next to each other: a brief
 * that reads better in isolation is not the same as one that answers this
 * question better, and the only way to tell is to see both against the same
 * input.
 *
 * These are **real runs**. They spend credits and appear in the run history like
 * any other, which the screen says rather than leaving somebody to discover it
 * on the bill.
 */
export function VersionComparison({
  workspaceId,
  agentId,
  versions,
  currentVersion,
  disabled,
}: {
  workspaceId: string;
  agentId: string;
  versions: AgentVersion[];
  currentVersion: number;
  disabled?: boolean;
}) {
  const [input, setInput] = useState("");
  const [chosen, setChosen] = useState<number[]>(() =>
    versions.length >= 2
      ? [versions[1]!.version, currentVersion].filter(
          (value, index, all) => all.indexOf(value) === index,
        )
      : [],
  );
  const [comparisonId, setComparisonId] = useState<string | null>(null);

  const start = useCompareVersions(workspaceId, agentId);
  const comparison = useComparison(workspaceId, comparisonId);

  const ready = input.trim().length > 0 && chosen.length >= 2 && chosen.length <= 4;

  if (versions.length < 2) return null;

  return (
    <DetailSection
      title="Try one question against several versions"
      description="Each version answers the same input, so you can read them side by side. These are real runs — they spend credits and appear in the run history."
    >
      <div className="space-y-2">
        <Label htmlFor="comparison-input">The question</Label>
        <Textarea
          id="comparison-input"
          rows={3}
          value={input}
          placeholder="Ask the thing this agent gets wrong."
          disabled={disabled}
          onChange={(event) => setInput(event.target.value)}
        />
      </div>

      <div className="mt-4 space-y-2">
        <Label>Versions to compare</Label>
        <div className="flex flex-wrap gap-3 rounded-lg border p-3">
          {versions.map((version) => {
            const picked = chosen.includes(version.version);
            // Four is the cap: every version named is a run that costs money.
            const full = chosen.length >= 4 && !picked;
            return (
              <label
                key={version.id}
                htmlFor={`compare-${version.version}`}
                className="flex items-center gap-2 text-sm"
              >
                <Checkbox
                  id={`compare-${version.version}`}
                  checked={picked}
                  disabled={disabled || full}
                  onCheckedChange={(checked) =>
                    setChosen((current) =>
                      checked
                        ? [...current, version.version]
                        : current.filter((value) => value !== version.version),
                    )
                  }
                />
                <span>
                  v{version.version}
                  {version.version === currentVersion && (
                    <span className="ml-1 text-xs text-muted-foreground">current</span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground">
          Two to four. One is not a comparison, and four runs of a premium model is
          already a real amount of credit to spend on one click.
        </p>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          disabled={disabled || !ready || start.isPending}
          onClick={() =>
            start.mutate(
              { input: input.trim(), versions: chosen },
              { onSuccess: (result) => setComparisonId(result.comparisonId) },
            )
          }
        >
          <Play className="size-4" />
          {start.isPending ? "Starting..." : `Run it on ${chosen.length} versions`}
        </Button>
      </div>

      {comparisonId && (
        <div className="mt-6">
          {comparison.isPending ? (
            <p className="text-sm text-muted-foreground">Queueing the runs…</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {(comparison.data?.runs ?? [])
                .slice()
                .sort((left, right) => (left.version ?? 0) - (right.version ?? 0))
                .map((run) => (
                  <ComparisonCard key={run.id} run={run} agentId={agentId} />
                ))}
            </div>
          )}
        </div>
      )}
    </DetailSection>
  );
}

function ComparisonCard({ run, agentId }: { run: ComparisonRun; agentId: string }) {
  const going = run.status === "pending" || run.status === "running";

  return (
    <section className="rounded-lg border p-3">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Version {run.version ?? "?"}</p>
        <div className="flex items-center gap-2">
          {going ? (
            <StatusBadge tone="info">{run.status}</StatusBadge>
          ) : run.status === "succeeded" ? (
            <StatusBadge tone="success">answered</StatusBadge>
          ) : (
            <StatusBadge tone="danger">{run.status}</StatusBadge>
          )}
          <span className="text-xs text-muted-foreground tabular-nums">
            {formatCredits(run.credits)} credits
          </span>
        </div>
      </header>

      <div className="mt-2">
        {going ? (
          <p className="text-sm text-muted-foreground">
            Still running. This updates itself.
          </p>
        ) : run.error ? (
          <p className="text-sm text-destructive">{run.error}</p>
        ) : (
          <p className="max-h-64 overflow-auto text-sm whitespace-pre-wrap">
            {run.output ?? "It produced no answer."}
          </p>
        )}
      </div>

      {!going && (
        <a
          href={`/agents/${agentId}/runs/${run.id}`}
          className="mt-2 inline-block text-xs text-primary hover:underline"
        >
          Open the run
        </a>
      )}
    </section>
  );
}
