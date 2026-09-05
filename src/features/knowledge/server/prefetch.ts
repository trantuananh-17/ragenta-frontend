import "server-only";

import { getQueryClient } from "@/lib/get-query-client";
import { knowledgeOptions } from "../options/knowledge.options";

export async function prefetchKnowledgeBases(workspaceId: string) {
  await getQueryClient().prefetchQuery(knowledgeOptions.bases(workspaceId));
}

export async function prefetchKnowledgeBase(
  workspaceId: string,
  baseId: string,
) {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(knowledgeOptions.base(workspaceId, baseId)),
    queryClient.prefetchQuery(knowledgeOptions.documents(workspaceId, baseId)),
  ]);
}

export async function prefetchDocument(
  workspaceId: string,
  documentId: string,
  page: number,
) {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(knowledgeOptions.document(workspaceId, documentId)),
    queryClient.prefetchQuery(
      knowledgeOptions.chunks(workspaceId, documentId, page),
    ),
  ]);
}
