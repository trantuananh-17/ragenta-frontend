import { Suspense } from "react";
import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import {
  ConnectionsError,
  ConnectionsLoading,
  ConnectionsScreen,
} from "@/features/connections/components";
import { prefetchConnections } from "@/features/connections/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Connections" };

export default async function ConnectionsPage() {
  const workspace = await requireWorkspace();
  await prefetchConnections(workspace.id);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<ConnectionsError />}>
        <Suspense fallback={<ConnectionsLoading />}>
          <ConnectionsScreen />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
