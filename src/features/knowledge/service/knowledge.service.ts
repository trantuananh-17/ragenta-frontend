import { z } from "zod";

import { api, apiUrl } from "@/lib/ky";
import { pageSchema } from "@/lib/pagination";
import { redirectToLogin, responseErrorMessage } from "@/lib/unauthorized";

/**
 * The chunking strategy's knobs, mirroring the backend's `parserConfigSchema`.
 *
 * Every field is optional and the whole object is `.catch({})` where it is read:
 * a base configured by a newer server must render on an older client rather than
 * failing the whole screen on one unknown key.
 */
export const parserConfigSchema = z.object({
  delimiters: z.array(z.string()).optional(),
  pages: z.array(z.tuple([z.number(), z.number()])).optional(),
  rowsPerChunk: z.number().optional(),
  qaColumns: z.object({ question: z.number(), answer: z.number() }).optional(),
  autoKeywords: z.number().optional(),
  autoQuestions: z.number().optional(),
  raptor: z
    .object({
      enabled: z.boolean(),
      maxLevels: z.number().optional(),
      threshold: z.number().optional(),
      maxClusterSize: z.number().optional(),
    })
    .optional(),
});

export type ParserConfig = z.infer<typeof parserConfigSchema>;

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
  parserId: z.string(),
  parserConfig: parserConfigSchema.catch({}),
  topK: z.number(),
  // numeric in Postgres, so these arrive as strings.
  similarityThreshold: z.coerce.number(),
  vectorWeight: z.coerce.number(),
  rerankProvider: z.string().nullable(),
  rerankModel: z.string().nullable(),
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
  "enriching",
  "embedding",
  "summarising",
  "ready",
  "failed",
  "cancelled",
] as const;

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number];

/** Statuses the worker is still moving through, so the row keeps polling. */
export const ACTIVE_DOCUMENT_STATUSES: readonly string[] = [
  "pending",
  "parsing",
  "chunking",
  "enriching",
  "embedding",
  "summarising",
];

export const documentSchema = z.object({
  id: z.string(),
  knowledgeBaseId: z.string(),
  name: z.string(),
  mimeType: z.string(),
  sizeBytes: z.number(),
  status: z.string(),
  error: z.string().nullable(),
  parserId: z.string().nullable(),
  parserConfig: parserConfigSchema.nullable().catch(null),
  /** 0..1. numeric in Postgres, so it arrives as a string. */
  progress: z.coerce.number(),
  progressMessage: z.string().nullable(),
  cancelRequested: z.boolean(),
  pageCount: z.number().nullable(),
  attempt: z.number(),
  processDurationMs: z.number().nullable(),
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
  kind: z.string(),
  question: z.string().nullable(),
  keywords: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([]),
  level: z.number(),
  fromPage: z.number().nullable(),
  toPage: z.number().nullable(),
  createdAt: z.coerce.string(),
});

/** One page range of an ingestion, and what it did. Drives the progress detail. */
export const ingestionTaskSchema = z.object({
  id: z.string(),
  taskType: z.string(),
  fromPage: z.number().nullable(),
  toPage: z.number().nullable(),
  status: z.string(),
  progressMessage: z.string().nullable(),
  error: z.string().nullable(),
  chunkCount: z.number(),
  attempt: z.number(),
  startedAt: z.coerce.string().nullable(),
  finishedAt: z.coerce.string().nullable(),
});

/** A chunking strategy the deployment offers. `available` false means it is declared, not built. */
export const chunkingMethodSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  formats: z.array(z.string()),
  available: z.boolean(),
  unavailable: z.string().nullable(),
});

export const knowledgeBasesPageSchema = pageSchema(knowledgeBaseSchema);
export const documentsPageSchema = pageSchema(documentSchema);
export const chunksPageSchema = pageSchema(chunkSchema);

export type KnowledgeBase = z.infer<typeof knowledgeBaseSchema>;
export type KnowledgeDocument = z.infer<typeof documentSchema>;
export type Chunk = z.infer<typeof chunkSchema>;
export type IngestionTask = z.infer<typeof ingestionTaskSchema>;
export type ChunkingMethod = z.infer<typeof chunkingMethodSchema>;

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
  parserId?: string;
  parserConfig?: ParserConfig;
  topK?: number;
  similarityThreshold?: number;
  vectorWeight?: number;
  rerank?: { provider: string; model: string } | null;
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
      parserId: input.parserId ?? "general",
      parserConfig: input.parserConfig ?? {},
      ...(input.topK !== undefined ? { topK: input.topK } : {}),
      ...(input.similarityThreshold !== undefined
        ? { similarityThreshold: input.similarityThreshold }
        : {}),
      ...(input.vectorWeight !== undefined
        ? { vectorWeight: input.vectorWeight }
        : {}),
      ...(input.rerank !== undefined ? { rerank: input.rerank } : {}),
    },
  });
  return knowledgeBaseSchema.parse(await response.json());
}

/** The strategies this deployment can actually run, and what each one reads. */
export async function getChunkingMethods(workspaceId: string) {
  const response = await api.get(
    `workspaces/${workspaceId}/knowledge-bases/chunking-methods`,
  );
  return z
    .object({ items: z.array(chunkingMethodSchema) })
    .parse(await response.json());
}

export interface UpdateKnowledgeBaseInput {
  name?: string;
  description?: string | null;
  chunkTokenSize?: number;
  chunkOverlapPercent?: number;
  parserId?: string;
  parserConfig?: ParserConfig;
  topK?: number;
  similarityThreshold?: number;
  vectorWeight?: number;
  rerank?: { provider: string; model: string } | null;
}

export async function updateKnowledgeBase(
  workspaceId: string,
  baseId: string,
  input: UpdateKnowledgeBaseInput,
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
  overrides: { parserId?: string; parserConfig?: ParserConfig } = {},
): Promise<KnowledgeDocument> {
  const form = new FormData();
  form.append("file", file);
  // Multipart carries strings, so the nested config goes as JSON in one field —
  // which is exactly what the controller parses it back out of.
  if (overrides.parserId) form.append("parserId", overrides.parserId);
  if (overrides.parserConfig) {
    form.append("parserConfig", JSON.stringify(overrides.parserConfig));
  }

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

/**
 * Re-index, optionally with a different chunking method.
 *
 * Only the page ranges whose settings changed are re-embedded — the backend
 * compares task digests — so re-indexing after a small change is cheap, and
 * re-indexing after none costs nothing at all.
 */
export async function reindexDocument(
  workspaceId: string,
  documentId: string,
  input: { parserId?: string | null; parserConfig?: ParserConfig | null } = {},
): Promise<KnowledgeDocument> {
  const response = await api.post(
    `workspaces/${workspaceId}/documents/${documentId}/reindex`,
    { json: input },
  );
  return documentSchema.parse(await response.json());
}

/** Asks the worker to stop between stages. Passages already indexed are kept. */
export async function cancelDocument(
  workspaceId: string,
  documentId: string,
): Promise<void> {
  await api.post(`workspaces/${workspaceId}/documents/${documentId}/cancel`);
}

export async function getIngestionTasks(
  workspaceId: string,
  documentId: string,
) {
  const response = await api.get(
    `workspaces/${workspaceId}/documents/${documentId}/tasks`,
  );
  return z
    .object({ items: z.array(ingestionTaskSchema) })
    .parse(await response.json());
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
