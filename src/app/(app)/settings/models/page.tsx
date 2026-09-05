import { Suspense } from "react";
import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import {
  ModelSettingsError,
  ModelSettingsLoading,
  ModelSettingsScreen,
} from "@/features/models/components";
import { prefetchModels } from "@/features/models/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Models" };

export default async function ModelsPage() {
  const workspace = await requireWorkspace();
  await prefetchModels(workspace.id);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<ModelSettingsError />}>
        <Suspense fallback={<ModelSettingsLoading />}>
          <ModelSettingsScreen />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
