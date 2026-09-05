import { Suspense } from "react";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import {
  DocumentDetail,
  DocumentError,
  DocumentLoading,
} from "@/features/knowledge/components";
import { prefetchDocument } from "@/features/knowledge/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export default async function DocumentPage({
  params,
}: {
  params: Promise<{ baseId: string; documentId: string }>;
}) {
  const { baseId, documentId } = await params;
  const workspace = await requireWorkspace();
  // Page 1 only: the chunk pager is client state, and prefetching every page a
  // reader might visit would fetch a whole document to render twenty passages.
  await prefetchDocument(workspace.id, documentId, 1);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<DocumentError />}>
        <Suspense fallback={<DocumentLoading />}>
          <DocumentDetail baseId={baseId} documentId={documentId} />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
