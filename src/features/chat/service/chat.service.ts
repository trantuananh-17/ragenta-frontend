import { z } from "zod";

import { api, apiUrl } from "@/lib/ky";
import { pageSchema } from "@/lib/pagination";
import { readSse } from "@/lib/sse";
import { redirectToLogin, responseErrorMessage } from "@/lib/unauthorized";

/**
 * One retrieved passage, frozen onto the answer that used it. The index is
 * 1-based and matches the [[n]] marker the model was asked to write, which is
 * what lets the renderer turn a marker into a hoverable source.
 */
export const citationSchema = z.object({
  index: z.number(),
  chunkId: z.string(),
  documentId: z.string(),
  documentName: z.string(),
  snippet: z.string(),
  score: z.number(),
  /**
   * passage | qa | row | summary. A `summary` was written by a model over
   * several parts of the document, not quoted from it, and the source card says
   * so — a citation that looks like a quotation and is not would be misleading.
   */
  kind: z.string().optional(),
  fromPage: z.number().nullable().optional(),
  toPage: z.number().nullable().optional(),
});

/** How the passages behind an answer are found. */
export const SEARCH_MODES = ["hybrid", "vector", "keyword"] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

export const conversationSchema = z.object({
  id: z.string(),
  projectId: z.string().nullable(),
  knowledgeBaseId: z.string().nullable(),
  /** Bases searched alongside the primary one. Absent on the list endpoint. */
  additionalKnowledgeBaseIds: z.array(z.string()).default([]),
  title: z.string(),
  searchMode: z.string().default("hybrid"),
  /** Null inherits the knowledge base's own setting. numeric arrives as a string. */
  topK: z.number().nullable().default(null),
  similarityThreshold: z.coerce.number().nullable().default(null),
  vectorWeight: z.coerce.number().nullable().default(null),
  rerankProvider: z.string().nullable().default(null),
  rerankModel: z.string().nullable().default(null),
  /** Answer only from retrieved passages. Meaningless without a knowledge base. */
  groundedOnly: z.boolean().default(true),
  /** Rewrite a follow-up into a standalone question before searching. */
  refineFollowUps: z.boolean().default(true),
  createdBy: z.string().nullable(),
  createdAt: z.coerce.string(),
  updatedAt: z.coerce.string(),
  lastMessageAt: z.coerce.string(),
  /** Present on the list only, from the left join. */
  knowledgeBaseName: z.string().nullable().optional(),
});

/**
 * An image carried by a turn, as every message lists it.
 *
 * No storage key: the backend never hands one out, and the bytes are addressed
 * through `attachmentContentUrl` instead. The pixel size is what a thumbnail
 * reserves its box with, and is null when the file's header did not give one.
 */
export const messageAttachmentSchema = z.object({
  id: z.string(),
  kind: z.string(),
  fileName: z.string(),
  mimeType: z.string(),
  width: z.number().nullable().default(null),
  height: z.number().nullable().default(null),
});

/** What an upload answers with: the summary above, plus what only its uploader needs. */
export const attachmentSchema = messageAttachmentSchema.extend({
  conversationId: z.string().nullable(),
  messageId: z.string().nullable(),
  sizeBytes: z.number(),
  status: z.string(),
  error: z.string().nullable(),
  createdAt: z.coerce.string(),
});

export const messageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.enum(["user", "assistant"]),
  content: z.string(),
  citations: z.array(citationSchema).default([]),
  // Defaulted, not required: a server that predates attachments answers without
  // the key, and one missing field must not empty a whole transcript.
  attachments: z.array(messageAttachmentSchema).default([]),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  // numeric in Postgres, so it arrives as a string.
  credits: z.coerce.number(),
  status: z.string(),
  error: z.string().nullable(),
  userId: z.string().nullable(),
  createdAt: z.coerce.string(),
});

export const conversationsPageSchema = pageSchema(conversationSchema);
export const messagesPageSchema = pageSchema(messageSchema);

export type Citation = z.infer<typeof citationSchema>;
export type MessageAttachment = z.infer<typeof messageAttachmentSchema>;
export type Attachment = z.infer<typeof attachmentSchema>;
export type Conversation = z.infer<typeof conversationSchema>;
export type Message = z.infer<typeof messageSchema>;

export async function getConversations(workspaceId: string, limit = 50) {
  const response = await api.get(`workspaces/${workspaceId}/conversations`, {
    searchParams: { limit, offset: 0 },
  });
  return conversationsPageSchema.parse(await response.json());
}

export async function getConversation(
  workspaceId: string,
  conversationId: string,
): Promise<Conversation> {
  const response = await api.get(
    `workspaces/${workspaceId}/conversations/${conversationId}`,
  );
  return conversationSchema.parse(await response.json());
}

export async function getMessages(workspaceId: string, conversationId: string) {
  const response = await api.get(
    `workspaces/${workspaceId}/conversations/${conversationId}/messages`,
    { searchParams: { limit: 100, offset: 0 } },
  );
  return messagesPageSchema.parse(await response.json());
}

/** The retrieval knobs a thread may override, shared by create and update. */
export interface RetrievalSettings {
  searchMode?: SearchMode;
  topK?: number | null;
  similarityThreshold?: number | null;
  vectorWeight?: number | null;
  rerank?: { provider: string; model: string } | null;
  groundedOnly?: boolean;
  refineFollowUps?: boolean;
}

export interface CreateConversationInput extends RetrievalSettings {
  title?: string;
  /** Attributes this thread's spend, and applies the project's model override. */
  projectId?: string | null;
  /** Null answers without retrieval — a plain model call, no citations. */
  knowledgeBaseId?: string | null;
  /** Must share the primary base's embedding model; the backend refuses otherwise. */
  additionalKnowledgeBaseIds?: string[];
}

export async function createConversation(
  workspaceId: string,
  input: CreateConversationInput,
): Promise<Conversation> {
  const response = await api.post(`workspaces/${workspaceId}/conversations`, {
    json: {
      title: input.title ?? "New conversation",
      projectId: input.projectId ?? null,
      knowledgeBaseId: input.knowledgeBaseId ?? null,
      additionalKnowledgeBaseIds: input.additionalKnowledgeBaseIds ?? [],
      ...retrievalPayload(input),
    },
  });
  return conversationSchema.parse(await response.json());
}

export interface UpdateConversationInput extends RetrievalSettings {
  title?: string;
  projectId?: string | null;
  knowledgeBaseId?: string | null;
  additionalKnowledgeBaseIds?: string[];
}

export async function updateConversation(
  workspaceId: string,
  conversationId: string,
  input: UpdateConversationInput,
): Promise<Conversation> {
  const response = await api.patch(
    `workspaces/${workspaceId}/conversations/${conversationId}`,
    {
      json: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.projectId !== undefined ? { projectId: input.projectId } : {}),
        ...(input.knowledgeBaseId !== undefined
          ? { knowledgeBaseId: input.knowledgeBaseId }
          : {}),
        ...(input.additionalKnowledgeBaseIds !== undefined
          ? { additionalKnowledgeBaseIds: input.additionalKnowledgeBaseIds }
          : {}),
        ...retrievalPayload(input),
      },
    },
  );
  return conversationSchema.parse(await response.json());
}

/**
 * Only the settings that were actually set. Sending `undefined` as `null` would
 * clear a thread's override every time anything else about it was edited.
 */
function retrievalPayload(input: RetrievalSettings) {
  return {
    ...(input.searchMode !== undefined ? { searchMode: input.searchMode } : {}),
    ...(input.topK !== undefined ? { topK: input.topK } : {}),
    ...(input.similarityThreshold !== undefined
      ? { similarityThreshold: input.similarityThreshold }
      : {}),
    ...(input.vectorWeight !== undefined
      ? { vectorWeight: input.vectorWeight }
      : {}),
    ...(input.rerank !== undefined ? { rerank: input.rerank } : {}),
    ...(input.groundedOnly !== undefined
      ? { groundedOnly: input.groundedOnly }
      : {}),
    ...(input.refineFollowUps !== undefined
      ? { refineFollowUps: input.refineFollowUps }
      : {}),
  };
}

export async function deleteConversation(
  workspaceId: string,
  conversationId: string,
): Promise<void> {
  await api.delete(`workspaces/${workspaceId}/conversations/${conversationId}`);
}

/** The backend refuses anything larger before it stores a byte. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/**
 * What the file picker offers. A hint only — the server decides the type from
 * the file's own first bytes, so a renamed `.exe` is refused there whatever this
 * attribute let someone choose.
 */
export const ACCEPTED_ATTACHMENT_TYPES = "image/png,image/jpeg,image/webp,image/gif";

/** `sendMessageSchema` caps a turn at six images, and so does the composer. */
export const MAX_TURN_ATTACHMENTS = 6;

/**
 * The bytes of one attachment, addressed directly.
 *
 * The endpoint answers 302 to a short-lived presigned URL, which is why this is
 * a URL rather than a fetch: the browser sends the session cookie to our own
 * origin, follows the redirect itself, and the image loads without the bytes
 * ever passing through JavaScript. Usable as an `<img src>` as it stands.
 */
export function attachmentContentUrl(
  workspaceId: string,
  attachmentId: string,
): string {
  return apiUrl(`workspaces/${workspaceId}/attachments/${attachmentId}/content`);
}

/**
 * Upload one image, before the turn that will carry it exists.
 *
 * Two steps rather than a multipart send: the image is stored and validated
 * while the question is still being typed, so pressing send stays a small JSON
 * request that either starts a stream or is refused outright. Raw fetch rather
 * than ky so the browser sets the multipart boundary itself — a hand-written
 * content-type header is the classic way to make a multipart upload fail.
 */
export async function uploadAttachment(
  workspaceId: string,
  file: File,
  signal?: AbortSignal,
): Promise<Attachment> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(apiUrl(`workspaces/${workspaceId}/attachments`), {
    method: "POST",
    body: form,
    signal,
  });

  if (!response.ok) {
    // Outside the ky client, so the shared 401 handling has to be asked for.
    if (response.status === 401) redirectToLogin();
    throw new Error(
      await responseErrorMessage(response, `Upload failed (${response.status}).`),
    );
  }

  return attachmentSchema.parse(await response.json());
}

/**
 * Drop an attachment that was never sent.
 *
 * Only that case: once the image is bound to a message the backend answers 409,
 * because a sent question and the image it asks about are one thing. Removing a
 * thumbnail from the composer is therefore the only caller.
 */
export async function deleteAttachment(
  workspaceId: string,
  attachmentId: string,
): Promise<void> {
  await api.delete(`workspaces/${workspaceId}/attachments/${attachmentId}`);
}

/** What one turn can carry beyond the question itself. */
export interface SendMessageInput {
  /** May be empty, but only when the turn carries attachments. */
  content: string;
  /** Images already uploaded, in the order they were attached. */
  attachmentIds?: string[];
  /** Narrows retrieval to specific documents. Empty means every document. */
  documentIds?: string[];
  model?: { provider: string; model: string };
  topK?: number;
  searchMode?: SearchMode;
  similarityThreshold?: number;
  vectorWeight?: number;
}

export type ChatStreamEvent =
  /** Arrives before any token. Its id is what the stop endpoint is addressed to. */
  | { type: "start"; messageId: string }
  /** Which part of the turn is running. Not progress — neither part knows. */
  | { type: "phase"; phase: "retrieving" | "generating" }
  /**
   * The standalone question retrieval actually searched for, sent only when the
   * server rewrote a follow-up. Shown so a rewrite that misread the thread is
   * visible to the one person who can tell.
   */
  | { type: "query"; question: string }
  | { type: "citations"; citations: Citation[] }
  | { type: "delta"; text: string }
  | {
      type: "done";
      messageId: string;
      /** True when the answer is this length because the user stopped it. */
      stopped: boolean;
      credits: number;
      usage: { input: number; output: number };
    }
  | { type: "error"; message: string };

const streamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), messageId: z.string() }),
  z.object({
    type: z.literal("phase"),
    phase: z.enum(["retrieving", "generating"]),
  }),
  z.object({ type: z.literal("query"), question: z.string() }),
  z.object({ type: z.literal("citations"), citations: z.array(citationSchema) }),
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({
    type: z.literal("done"),
    messageId: z.string(),
    // Defaulted rather than required: a server that predates the stopped flag
    // must not make every finished answer fail this schema and vanish.
    stopped: z.boolean().default(false),
    credits: z.number(),
    usage: z.object({ input: z.number(), output: z.number() }),
  }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

/**
 * Ask the server to stop a turn that is generating.
 *
 * Deliberately a request rather than an abort of the streaming fetch. The
 * generating request is the only thing that can save the partial answer, so it
 * is asked to finish early instead of being killed: it stops pulling from the
 * provider, writes what it has, and closes the stream with its normal `done`
 * frame. The text already on screen therefore survives, because it is in the
 * database before the client stops reading.
 */
export async function stopMessage(
  workspaceId: string,
  conversationId: string,
  messageId: string,
): Promise<void> {
  await api.post(
    `workspaces/${workspaceId}/conversations/${conversationId}/messages/${messageId}/stop`,
  );
}

/**
 * One turn, streamed.
 *
 * Deliberately raw fetch rather than the ky client: ky buffers a response before
 * handing it back, which would hold every token until the answer was complete.
 * Everything that can refuse the turn — no credits, a model outside the plan, a
 * knowledge base that has gone — is refused before the stream opens, so a non-OK
 * response here carries a normal JSON error body.
 */
export async function* streamMessage(
  workspaceId: string,
  conversationId: string,
  input: SendMessageInput,
  signal?: AbortSignal,
): AsyncGenerator<ChatStreamEvent> {
  const response = await fetch(
    `/api/v1/workspaces/${workspaceId}/conversations/${conversationId}/messages/stream`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
      signal,
    },
  );

  if (!response.ok) {
    // Outside the ky client, so the shared 401 handling has to be asked for.
    if (response.status === 401) redirectToLogin();
    throw new Error(
      await responseErrorMessage(response, "The answer could not be started."),
    );
  }

  for await (const frame of readSse(response, signal)) {
    // Both the parse and the schema check are non-fatal. A frame truncated by a
    // dropped connection, or an event type a later server adds, must not throw
    // and discard an answer that is already half on screen.
    let payload: unknown;
    try {
      payload = JSON.parse(frame.data);
    } catch {
      continue;
    }

    const parsed = streamEventSchema.safeParse(payload);
    if (parsed.success) yield parsed.data;
  }
}
