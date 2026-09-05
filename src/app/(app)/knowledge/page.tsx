import { Suspense } from "react";
import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import {
  KnowledgeBasesError,
  KnowledgeBasesLoading,
  KnowledgeBasesScreen,
} from "@/features/knowledge/components";
import { prefetchKnowledgeBases } from "@/features/knowledge/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Knowledge bases" };

export default async function KnowledgePage() {
  const workspace = await requireWorkspace();
  await prefetchKnowledgeBases(workspace.id);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<KnowledgeBasesError />}>
        <Suspense fallback={<KnowledgeBasesLoading />}>
          <KnowledgeBasesScreen />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
