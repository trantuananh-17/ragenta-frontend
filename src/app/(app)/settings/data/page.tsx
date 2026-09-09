import { Suspense } from "react";
import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import { PlanGate } from "@/components/plan-gate";
import { resolvePlanGate } from "@/features/billing/server/prefetch";
import {
  DataSourcesError,
  DataSourcesLoading,
  DataSourcesPreview,
  DataSourcesScreen,
} from "@/features/data-sources/components";
import { prefetchDataSources } from "@/features/data-sources/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Databases" };

/**
 * The whole screen is gated, so both halves of the gate live here: the list is
 * not prefetched on a plan without data sources, and `PlanGate` renders the
 * replica instead of the screen that would otherwise fetch it on the client.
 */
export default async function DataPage() {
  const workspace = await requireWorkspace();
  const allowed = await resolvePlanGate(workspace.id, "dataSourcesEnabled");
  if (allowed) await prefetchDataSources(workspace.id);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<DataSourcesError />}>
        <Suspense fallback={<DataSourcesLoading />}>
          <PlanGate feature="dataSourcesEnabled" preview={<DataSourcesPreview />}>
            <DataSourcesScreen />
          </PlanGate>
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
