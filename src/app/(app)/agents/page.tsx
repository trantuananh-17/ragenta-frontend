import { Suspense } from "react";
import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import {
  AgentsError,
  AgentsLoading,
  AgentsScreen,
} from "@/features/agents/components";
import { prefetchAgents } from "@/features/agents/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Agents" };

export default async function AgentsPage() {
  const workspace = await requireWorkspace();
  await prefetchAgents(workspace.id);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<AgentsError />}>
        <Suspense fallback={<AgentsLoading />}>
          <AgentsScreen />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
