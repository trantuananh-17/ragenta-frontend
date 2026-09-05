import { z } from "zod";

import { api, apiUrl } from "@/lib/ky";
import { pageSchema } from "@/lib/pagination";
import { redirectToLogin, responseErrorMessage } from "@/lib/unauthorized";

/**
 * A knowledge base belongs to the workspace, not to a project (ADR-019), and its
 * embedding model is frozen at creation — vectors from two models are not
 * comparable, so it is shown as a fact about the base rather than a setting.
 */
export const knowledgeBaseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable(),
  embeddingProvider: z.string(),
  embeddingModel: z.string(),
  embeddingDimensions: z.number(),
  chunkTokenSize: z.number(),
  chunkOverlapPercent: z.number(),
  documentCount: z.number(),
  chunkCount: z.number(),
  createdBy: z.string().nullable(),
  createdAt: z.coerce.string(),
  updatedAt: z.coerce.string(),
});

/** The ingestion state machine the worker advances, in the order it runs. */
export const DOCUMENT_STATUSES = [
  "pending",
  "parsing",
  "chunking",
  "embedding",
  "ready",
  "failed",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

export const documentSchema = z.object({
  id: z.string(),
  knowledgeBaseId: z.string(),
  name: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  status: z.string(),
  error: z.string().nullable(),
  chunkCount: z.number(),
  tokenCount: z.number(),
  createdBy: z.string().nullable(),
  createdAt: z.coerce.string(),
  updatedAt: z.coerce.string(),
  indexedAt: z.coerce.string().nullable(),
});

export const chunkSchema = z.object({
  id: z.string(),
  documentId: z.string(),
  ordinal: z.number(),
  content: z.string(),
  tokenCount: z.number(),
  createdAt: z.coerce.string(),
});

export const knowledgeBasesPageSchema = pageSchema(knowledgeBaseSchema);
export const documentsPageSchema = pageSchema(documentSchema);
export const chunksPageSchema = pageSchema(chunkSchema);

export type KnowledgeBase = z.infer<typeof knowledgeBaseSchema>;
export type KnowledgeDocument = z.infer<typeof documentSchema>;
export type Chunk = z.infer<typeof chunkSchema>;

/** The backend refuses anything larger before it stores a byte. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export async function getKnowledgeBases(workspaceId: string) {
  const response = await api.get(`workspaces/${workspaceId}/knowledge-bases`, {
    searchParams: { limit: 100, offset: 0 },
  });
  return knowledgeBasesPageSchema.parse(await response.json());
}

export async function getKnowledgeBase(
  workspaceId: string,
  baseId: string,
): Promise<KnowledgeBase> {
  const response = await api.get(
    `workspaces/${workspaceId}/knowledge-bases/${baseId}`,
  );
  return knowledgeBaseSchema.parse(await response.json());
}

export interface CreateKnowledgeBaseInput {
  name: string;
  description?: string | null;
  /** Omitted means the workspace's embedding setting, resolved server-side. */
  embedding?: { provider: string; model: string };
  chunkTokenSize?: number;
  chunkOverlapPercent?: number;
}

export async function createKnowledgeBase(
  workspaceId: string,
  input: CreateKnowledgeBaseInput,
): Promise<KnowledgeBase> {
  const response = await api.post(`workspaces/${workspaceId}/knowledge-bases`, {
    json: {
      name: input.name,
      description: input.description ?? null,
      ...(input.embedding ? { embedding: input.embedding } : {}),
      chunkTokenSize: input.chunkTokenSize ?? 512,
      chunkOverlapPercent: input.chunkOverlapPercent ?? 15,
    },
  });
  return knowledgeBaseSchema.parse(await response.json());
}

export async function updateKnowledgeBase(
  workspaceId: string,
  baseId: string,
  input: { name?: string; description?: string | null },
): Promise<KnowledgeBase> {
  const response = await api.patch(
    `workspaces/${workspaceId}/knowledge-bases/${baseId}`,
    { json: input },
  );
  return knowledgeBaseSchema.parse(await response.json());
}

export async function deleteKnowledgeBase(
  workspaceId: string,
  baseId: string,
): Promise<void> {
  await api.delete(`workspaces/${workspaceId}/knowledge-bases/${baseId}`);
}

export async function getDocuments(workspaceId: string, baseId: string) {
  const response = await api.get(
    `workspaces/${workspaceId}/knowledge-bases/${baseId}/documents`,
    { searchParams: { limit: 100, offset: 0 } },
  );
  return documentsPageSchema.parse(await response.json());
}

export async function getDocument(
  workspaceId: string,
  documentId: string,
): Promise<KnowledgeDocument> {
  const response = await api.get(
    `workspaces/${workspaceId}/documents/${documentId}`,
  );
  return documentSchema.parse(await response.json());
}

export async function getChunks(
  workspaceId: string,
  documentId: string,
  params: { limit: number; offset: number },
) {
  const response = await api.get(
    `workspaces/${workspaceId}/documents/${documentId}/chunks`,
    { searchParams: params },
  );
  return chunksPageSchema.parse(await response.json());
}

/**
 * Upload.
 *
 * `multipart/form-data`, not JSON with base64 — that is what the backend parses,
 * and base64 would inflate the payload by a third for no gain. Raw fetch rather
 * than ky so the browser sets the multipart boundary itself; a hand-written
 * content-type header is the classic way to make a multipart upload fail.
 */
export async function uploadDocument(
  workspaceId: string,
  baseId: string,
  file: File,
): Promise<KnowledgeDocument> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(
    apiUrl(`workspaces/${workspaceId}/knowledge-bases/${baseId}/documents`),
    { method: "POST", body: form },
  );

  if (!response.ok) {
    // Outside the ky client, so the shared 401 handling has to be asked for.
    if (response.status === 401) redirectToLogin();
    throw new Error(
      await responseErrorMessage(response, `Upload failed (${response.status}).`),
    );
  }

  return documentSchema.parse(await response.json());
}

export async function reindexDocument(
  workspaceId: string,
  documentId: string,
): Promise<KnowledgeDocument> {
  const response = await api.post(
    `workspaces/${workspaceId}/documents/${documentId}/reindex`,
  );
  return documentSchema.parse(await response.json());
}

export async function deleteDocument(
  workspaceId: string,
  documentId: string,
): Promise<void> {
  await api.delete(`workspaces/${workspaceId}/documents/${documentId}`);
}

/** A short-lived direct URL into object storage. The API never streams bytes. */
export async function getDownloadUrl(
  workspaceId: string,
  documentId: string,
): Promise<{ url: string; name: string }> {
  const response = await api.get(
    `workspaces/${workspaceId}/documents/${documentId}/download`,
  );
  return z
    .object({ url: z.string(), name: z.string() })
    .parse(await response.json());
}
