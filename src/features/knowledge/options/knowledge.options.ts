import { queryOptions } from "@tanstack/react-query";

import {
  getChunks,
  getDocument,
  getDocuments,
  getKnowledgeBase,
  getKnowledgeBases,
  type KnowledgeDocument,
} from "../service/knowledge.service";

export const knowledgeKeys = {
  all: () => ["knowledge"] as const,
  bases: (workspaceId: string) =>
    [...knowledgeKeys.all(), "bases", workspaceId] as const,
  base: (workspaceId: string, baseId: string) =>
    [...knowledgeKeys.all(), "base", workspaceId, baseId] as const,
  documents: (workspaceId: string, baseId: string) =>
    [...knowledgeKeys.all(), "documents", workspaceId, baseId] as const,
  document: (workspaceId: string, documentId: string) =>
    [...knowledgeKeys.all(), "document", workspaceId, documentId] as const,
  chunks: (workspaceId: string, documentId: string, page: number) =>
    [...knowledgeKeys.all(), "chunks", workspaceId, documentId, page] as const,
};

/** Ingestion runs in a worker, so a document in flight is polled, not pushed. */
const INGESTION_POLL_MS = 3_000;

function stillIngesting(documents: KnowledgeDocument[]): boolean {
  return documents.some(
    (document) => document.status !== "ready" && document.status !== "failed",
  );
}

export const knowledgeOptions = {
  bases: (workspaceId: string) =>
    queryOptions({
      queryKey: knowledgeKeys.bases(workspaceId),
      queryFn: () => getKnowledgeBases(workspaceId),
    }),
  base: (workspaceId: string, baseId: string) =>
    queryOptions({
      queryKey: knowledgeKeys.base(workspaceId, baseId),
      queryFn: () => getKnowledgeBase(workspaceId, baseId),
    }),
  documents: (workspaceId: string, baseId: string) =>
    queryOptions({
      queryKey: knowledgeKeys.documents(workspaceId, baseId),
      queryFn: () => getDocuments(workspaceId, baseId),
      // Polls only while something is actually being parsed or embedded, and
      // stops the moment every row has settled.
      refetchInterval: (query) =>
        query.state.data && stillIngesting(query.state.data.items)
          ? INGESTION_POLL_MS
          : false,
    }),
  document: (workspaceId: string, documentId: string) =>
    queryOptions({
      queryKey: knowledgeKeys.document(workspaceId, documentId),
      queryFn: () => getDocument(workspaceId, documentId),
      refetchInterval: (query) =>
        query.state.data && stillIngesting([query.state.data])
          ? INGESTION_POLL_MS
          : false,
    }),
  chunks: (workspaceId: string, documentId: string, page: number, limit = 20) =>
    queryOptions({
      queryKey: knowledgeKeys.chunks(workspaceId, documentId, page),
      queryFn: () =>
        getChunks(workspaceId, documentId, {
          limit,
          offset: Math.max(0, (page - 1) * limit),
        }),
    }),
};
