import { Suspense } from "react";
import type { Metadata } from "next";
import type { SearchParams } from "nuqs/server";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import {
  UsageError,
  UsageLoading,
  UsageScreen,
} from "@/features/usage/components";
import { usageParamsLoader } from "@/features/usage/server/params-loader";
import { prefetchUsage } from "@/features/usage/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Usage" };

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const workspace = await requireWorkspace();
  const params = await usageParamsLoader(searchParams);
  await prefetchUsage(workspace.id, params);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<UsageError />}>
        <Suspense fallback={<UsageLoading />}>
          <UsageScreen />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
