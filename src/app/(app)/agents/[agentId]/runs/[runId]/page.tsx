import { Suspense } from "react";
import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import { RunDetail, RunError, RunLoading } from "@/features/agents/components";
import { prefetchAgentRun } from "@/features/agents/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Agent run" };

export default async function AgentRunPage({
  params,
}: {
  params: Promise<{ agentId: string; runId: string }>;
}) {
  const { agentId, runId } = await params;
  const workspace = await requireWorkspace();
  await prefetchAgentRun(workspace.id, runId);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<RunError />}>
        <Suspense fallback={<RunLoading />}>
          <RunDetail agentId={agentId} runId={runId} />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
