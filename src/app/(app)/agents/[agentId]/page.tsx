import { Suspense } from "react";
import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import {
  AgentDetail,
  AgentError,
  AgentLoading,
} from "@/features/agents/components";
import { prefetchAgent } from "@/features/agents/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Agent" };

export default async function AgentPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;
  const workspace = await requireWorkspace();
  await prefetchAgent(workspace.id, agentId);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<AgentError />}>
        <Suspense fallback={<AgentLoading />}>
          <AgentDetail agentId={agentId} />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
