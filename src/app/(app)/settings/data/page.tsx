import { Suspense } from "react";
import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import {
  DataSourcesError,
  DataSourcesLoading,
  DataSourcesScreen,
} from "@/features/data-sources/components";
import { prefetchDataSources } from "@/features/data-sources/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Databases" };

export default async function DataPage() {
  const workspace = await requireWorkspace();
  await prefetchDataSources(workspace.id);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<DataSourcesError />}>
        <Suspense fallback={<DataSourcesLoading />}>
          <DataSourcesScreen />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
