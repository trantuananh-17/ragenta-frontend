import { Suspense } from "react";
import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import {
  WorkspaceSettings,
  WorkspaceSettingsError,
  WorkspaceSettingsLoading,
} from "@/features/workspace/components";
import { prefetchWorkspaceOverview } from "@/features/workspace/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Workspace settings" };

export default async function WorkspaceSettingsPage() {
  const workspace = await requireWorkspace();
  await prefetchWorkspaceOverview(workspace.id);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<WorkspaceSettingsError />}>
        <Suspense fallback={<WorkspaceSettingsLoading />}>
          <WorkspaceSettings />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
