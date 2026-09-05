import { Suspense } from "react";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import {
  KnowledgeBaseDetail,
  KnowledgeBaseError,
  KnowledgeBaseLoading,
} from "@/features/knowledge/components";
import { prefetchKnowledgeBase } from "@/features/knowledge/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export default async function KnowledgeBasePage({
  params,
}: {
  params: Promise<{ baseId: string }>;
}) {
  const { baseId } = await params;
  const workspace = await requireWorkspace();
  await prefetchKnowledgeBase(workspace.id, baseId);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<KnowledgeBaseError />}>
        <Suspense fallback={<KnowledgeBaseLoading />}>
          <KnowledgeBaseDetail baseId={baseId} />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
