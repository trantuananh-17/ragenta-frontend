"use client";

import { DetailSection, DetailShell } from "@/components/detail-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { AnswerBody } from "@/features/chat/components/chat-message";
import { attachmentContentUrl } from "@/features/chat/service/chat.service";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import { formatCredits, formatDateTime } from "@/lib/format";
import { useAgentRunSteps, useAgentRunSuspense } from "../hooks/agents.hook";
import type { AgentRunStep } from "../service/agents.service";
import { RunSteps } from "./run-steps";

interface ProducedFile {
  seq: number;
  step: string;
  attachmentId: string;
  fileName: string;
  sizeBytes: number | null;
}

/**
 * The files this run created, as opposed to the ones it read.
 *
 * Several tools report an `attachmentId` and most of them mean the file they
 * were given — the picture a vision step looked at, the workbook a read step
 * opened. Offering those back as results would hand somebody their own upload
 * and call it output, so the producing tools say `produced: true` and this
 * reads that rather than guessing from the shape of the metadata.
 */
function producedFiles(steps: AgentRunStep[] | undefined): ProducedFile[] {
  return (steps ?? []).flatMap((step) => {
    const output = step.output as Record<string, unknown>;
    if (output.produced !== true || typeof output.attachmentId !== "string") return [];

    return [
      {
        seq: step.seq,
        step: step.name ?? step.kind,
        attachmentId: output.attachmentId,
        fileName:
          typeof output.fileName === "string" ? output.fileName : "attachment",
        sizeBytes: typeof output.sizeBytes === "number" ? output.sizeBytes : null,
      },
    ];
  });
}

/** Bytes as something a person reads, without pulling in a formatter for one call site. */
function fileSize(bytes: number | null): string | null {
  if (bytes === null) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * The run's own error, pointed at the step that owns it.
 *
 * On its own this line names no owner, and a flow with eight steps gives it
 * eight possible authors — somebody spent an afternoon editing the wrong one.
 * The reason itself belongs on the failed step, so this only says where to look.
 */
function RunFailure({
  error,
  failed,
  className,
}: {
  error: string;
  failed: AgentRunStep[];
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-sm text-destructive break-words whitespace-pre-wrap">
        {error}
      </p>
      {failed.length > 0 && (
        <p className="mt-1 text-xs text-muted-foreground">
          {failed.length === 1
            ? `Step ${failed[0].seq} · ${failed[0].name ?? failed[0].kind} failed.`
            : `Steps ${failed.map((step) => step.seq).join(", ")} failed.`}{" "}
          Under Steps below, each says why and what it was given.
        </p>
      )}
    </div>
  );
}

/** succeeded is green; stopped is a choice, not a failure, so it is not red. */
export function RunStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge
      tone={
        status === "succeeded"
          ? "success"
          : status === "failed"
            ? "danger"
            : status === "stopped"
              ? "warning"
              : "info"
      }
    >
      {status}
    </StatusBadge>
  );
}

export function RunDetail({ agentId, runId }: { agentId: string; runId: string }) {
  const { workspace } = useWorkspace();
  const { data: run } = useAgentRunSuspense(workspace.id, runId);
  const { data: steps } = useAgentRunSteps(workspace.id, runId);
  const files = producedFiles(steps);
  const failed = (steps ?? []).filter((step) => step.status === "failed");

  const question = typeof run.input.input === "string" ? run.input.input : "";

  return (
    <DetailShell>
      <PageHeader
        back={{ href: `/agents/${agentId}`, label: "Agent" }}
        title="Run"
        description={formatDateTime(run.startedAt)}
        badges={
          <>
            <RunStatusBadge status={run.status} />
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatCredits(run.credits)} credits
            </span>
            <span className="text-xs text-muted-foreground">{run.trigger}</span>
          </>
        }
      />

      {question && (
        <DetailSection title="Input">
          <p className="text-sm whitespace-pre-wrap">{question}</p>
        </DetailSection>
      )}

      <DetailSection title="Output">
        {run.output ? (
          <AnswerBody content={run.output} citations={[]} />
        ) : (
          !run.error && (
            <p className="text-sm text-muted-foreground">
              This run produced no output.
            </p>
          )
        )}
        {run.error && (
          <RunFailure
            error={run.error}
            failed={failed}
            className={run.output ? "mt-3" : undefined}
          />
        )}
      </DetailSection>

      {files.length > 0 && (
        <DetailSection
          title="Files"
          description="Produced by this run and stored on the workspace. Opening one goes through this app, so the link works only while you are signed in — it is not a public URL."
        >
          <ul className="divide-y rounded-lg border">
            {files.map((file) => (
              <li
                key={file.attachmentId}
                className="flex items-center gap-3 p-3"
              >
                <FileSpreadsheet className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{file.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    Step {file.seq} · {file.step}
                    {fileSize(file.sizeBytes) ? ` · ${fileSize(file.sizeBytes)}` : ""}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  {/*
                    A plain link rather than a fetch: the endpoint answers 302 to a
                    short-lived signed URL, and letting the browser follow it keeps
                    the bytes out of JavaScript entirely. `download` asks for a save
                    rather than a tab, which is what a spreadsheet wants.
                  */}
                  <a
                    href={attachmentContentUrl(workspace.id, file.attachmentId)}
                    download={file.fileName}
                  >
                    <Download className="size-4" />
                    Download
                  </a>
                </Button>
              </li>
            ))}
          </ul>
        </DetailSection>
      )}

      <DetailSection
        title="Steps"
        description="What the run did, in order. Open a row to read what that step was given and what it produced; a step that failed says why without being opened. A tool that only read or fetched cost nothing."
      >
        {!steps || steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This run made no billable call.
          </p>
        ) : (
          <RunSteps steps={steps} />
        )}
      </DetailSection>
    </DetailShell>
  );
}

export function RunLoading() {
  return (
    <DetailShell>
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-48 rounded-lg" />
    </DetailShell>
  );
}

export function RunError() {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
      This run could not be loaded.
    </div>
  );
}
