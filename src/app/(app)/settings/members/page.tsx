import { Suspense } from "react";
import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import {
  MembersError,
  MembersLoading,
  MembersScreen,
} from "@/features/workspace/components";
import {
  prefetchMembers,
  prefetchWorkspaceOverview,
} from "@/features/workspace/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Members" };

export default async function MembersPage() {
  const workspace = await requireWorkspace();
  await Promise.all([
    prefetchWorkspaceOverview(workspace.id),
    prefetchMembers(workspace.id),
  ]);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<MembersError />}>
        <Suspense fallback={<MembersLoading />}>
          <MembersScreen />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
