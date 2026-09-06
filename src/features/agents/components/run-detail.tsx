"use client";

import { DetailSection, DetailShell } from "@/components/detail-shell";
import { PageHeader } from "@/components/page-header";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AnswerBody } from "@/features/chat/components/chat-message";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import { formatCredits, formatDateTime, formatNumber } from "@/lib/format";
import { useAgentRunSteps, useAgentRunSuspense } from "../hooks/agents.hook";

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
          <p className="text-sm text-muted-foreground">
            {run.error ?? "This run produced no output."}
          </p>
        )}
        {run.output && run.error && (
          <p className="mt-3 text-sm text-destructive">{run.error}</p>
        )}
      </DetailSection>

      <DetailSection
        title="Steps"
        description="What the run did, in order. Every row that made a provider call carries the usage reference it was billed under; a tool that only read or fetched cost nothing."
      >
        {!steps || steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This run made no billable call.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Step</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead className="text-right">In</TableHead>
                  <TableHead className="text-right">Out</TableHead>
                  <TableHead className="text-right">Credits</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {steps.map((step) => (
                  <TableRow key={step.id}>
                    <TableCell className="tabular-nums">{step.seq}</TableCell>
                    <TableCell>
                      {step.name ?? step.kind}
                      {step.name && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {step.kind}
                        </span>
                      )}
                      {step.status === "failed" && (
                        <span className="ml-1 text-xs text-destructive">failed</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {step.model ? `${step.provider} / ${step.model}` : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(step.inputTokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(step.outputTokens)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCredits(step.credits)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
