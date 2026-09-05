import { Suspense } from "react";
import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import {
  ProjectsError,
  ProjectsLoading,
  ProjectsScreen,
} from "@/features/projects/components";
import { prefetchProjects } from "@/features/projects/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const workspace = await requireWorkspace();
  // The archived toggle is client state, so only the default view is prefetched.
  await prefetchProjects(workspace.id, false);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<ProjectsError />}>
        <Suspense fallback={<ProjectsLoading />}>
          <ProjectsScreen />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
