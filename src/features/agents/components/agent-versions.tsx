"use client";

import { useState } from "react";
import { History, RotateCcw } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DetailSection } from "@/components/detail-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime } from "@/lib/format";
import {
  useAgentVersions,
  useRestoreVersion,
  useVersionDiff,
} from "../hooks/agents.hook";
import type { FieldChange } from "../service/agents.service";
import { VersionComparison } from "./version-comparison";

/**
 * The agent's history, and a way back into it.
 *
 * Every version has always been kept — what was missing was any way to read
 * them. The screen answers one question: what did somebody change, and can I
 * undo it. Going back **publishes the old configuration again** rather than
 * moving a pointer, which the button says out loud: the version number goes up,
 * not down, and the run history stays unambiguous about which configuration
 * produced which answer.
 */
export function AgentVersions({
  workspaceId,
  agentId,
  currentVersion,
  canPublish,
  canRun,
}: {
  workspaceId: string;
  agentId: string;
  currentVersion: number;
  /** Going back publishes, so it is gated on publishing. */
  canPublish: boolean;
  /**
   * Comparing spends credits, so it is gated on running — a separate
   * permission, and roles are composable now, so a role with one and not the
   * other is a shape somebody can actually build.
   */
  canRun: boolean;
}) {
  const { data: versions, isPending } = useAgentVersions(workspaceId, agentId);
  const restore = useRestoreVersion(workspaceId, agentId);

  /** The pair being compared. Defaults to the two most recent once they load. */
  const [pair, setPair] = useState<{ from: number; to: number } | null>(null);
  const [restoring, setRestoring] = useState<number | null>(null);

  const ordered = [...(versions ?? [])].sort((left, right) => right.version - left.version);
  const chosen =
    pair ??
    (ordered.length >= 2
      ? { from: ordered[1]!.version, to: ordered[0]!.version }
      : null);

  const diff = useVersionDiff(
    workspaceId,
    agentId,
    chosen?.from ?? null,
    chosen?.to ?? null,
  );

  if (isPending) return <Skeleton className="h-48" />;

  return (
    <div className="space-y-6">
      <DetailSection
        title="Versions"
        description="Every published configuration, kept. A run records the version it ran, so an answer from last month stays explainable against the settings that produced it."
      >
        {ordered.length === 0 ? (
          <p className="text-sm text-muted-foreground">No version has been published.</p>
        ) : (
          <ul className="space-y-2">
            {ordered.map((version) => {
              const isCurrent = version.version === currentVersion;
              return (
                <li
                  key={version.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-md border px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <History className="size-4 text-muted-foreground" />
                      Version {version.version}
                      {isCurrent && <StatusBadge tone="success">current</StatusBadge>}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDateTime(version.createdAt)}
                      {version.graph ? " · a flow" : " · a single prompt"}
                      {version.tools.length > 0 &&
                        ` · ${version.tools.length} ${version.tools.length === 1 ? "tool" : "tools"}`}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={version.version === currentVersion}
                      onClick={() =>
                        setPair({ from: version.version, to: currentVersion })
                      }
                    >
                      Compare with current
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!canPublish || isCurrent || restore.isPending}
                      onClick={() => setRestoring(version.version)}
                    >
                      <RotateCcw className="size-4" />
                      Go back to this
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </DetailSection>

      {chosen && (
        <DetailSection
          title={`What changed between version ${chosen.from} and version ${chosen.to}`}
          description="Only the settings that differ. Reordering tools or knowledge bases is not a change, and neither is a number written a different way."
        >
          {diff.isPending ? (
            <Skeleton className="h-24" />
          ) : diff.isError ? (
            <p className="text-sm text-muted-foreground">
              That comparison could not be loaded.
            </p>
          ) : diff.data?.changes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing differs. The two versions are the same configuration published
              twice — which happens when a flow is published without the settings
              alongside it changing.
            </p>
          ) : (
            <ul className="space-y-4">
              {diff.data?.changes.map((change) => (
                <li key={change.field}>
                  <ChangeRow change={change} />
                </li>
              ))}
            </ul>
          )}
        </DetailSection>
      )}

      <VersionComparison
        workspaceId={workspaceId}
        agentId={agentId}
        versions={ordered}
        currentVersion={currentVersion}
        disabled={!canRun}
      />

      <ConfirmDialog
        open={restoring !== null}
        onOpenChange={(open) => !open && setRestoring(null)}
        title={`Go back to version ${restoring ?? ""}?`}
        description={`Its configuration is published again as version ${currentVersion + 1}. Nothing is overwritten and no version is deleted — the number goes up, not down, so every past run stays readable against the version it actually ran.`}
        confirmLabel="Publish it again"
        pending={restore.isPending}
        onConfirm={() => {
          if (restoring === null) return;
          restore.mutate(restoring, { onSuccess: () => setRestoring(null) });
        }}
      />
    </div>
  );
}

/** One changed setting, rendered by what kind of thing it is. */
function ChangeRow({ change }: { change: FieldChange }) {
  if (change.kind === "list") {
    const before = toStrings(change.before);
    const after = toStrings(change.after);
    const added = after.filter((entry) => !before.includes(entry));
    const removed = before.filter((entry) => !after.includes(entry));

    return (
      <div>
        <p className="text-sm font-medium">{change.label}</p>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {added.map((entry) => (
            <span
              key={`add-${entry}`}
              className="rounded bg-emerald-500/10 px-1.5 py-0.5 font-mono text-xs text-emerald-700 dark:text-emerald-400"
            >
              + {entry}
            </span>
          ))}
          {removed.map((entry) => (
            <span
              key={`remove-${entry}`}
              className="rounded bg-red-500/10 px-1.5 py-0.5 font-mono text-xs text-red-700 line-through dark:text-red-400"
            >
              {entry}
            </span>
          ))}
          {added.length === 0 && removed.length === 0 && (
            <span className="text-xs text-muted-foreground">
              {before.length} → {after.length}
            </span>
          )}
        </div>
      </div>
    );
  }

  if (change.kind === "text") {
    return (
      <div>
        <p className="text-sm font-medium">{change.label}</p>
        <div className="mt-1 grid gap-2 md:grid-cols-2">
          <pre className="max-h-48 overflow-auto rounded border bg-red-500/5 p-2 text-xs whitespace-pre-wrap">
            {display(change.before)}
          </pre>
          <pre className="max-h-48 overflow-auto rounded border bg-emerald-500/5 p-2 text-xs whitespace-pre-wrap">
            {display(change.after)}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-baseline gap-2">
      <span className="text-sm font-medium">{change.label}</span>
      <span className="font-mono text-xs text-muted-foreground line-through">
        {display(change.before)}
      </span>
      <span className="text-muted-foreground">→</span>
      <span className="font-mono text-xs">{display(change.after)}</span>
    </div>
  );
}

function toStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

/**
 * A stored value as somebody reads it.
 *
 * "not set" rather than an empty cell, because a blank next to an arrow is
 * ambiguous between "cleared" and "the screen did not render it".
 */
function display(value: unknown): string {
  if (value === null || value === undefined || value === "") return "not set";
  if (typeof value === "boolean") return value ? "on" : "off";
  if (typeof value === "object") return "a flow";
  return String(value);
}
