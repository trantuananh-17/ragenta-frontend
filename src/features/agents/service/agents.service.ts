import { z } from "zod";

import { api } from "@/lib/ky";
import { pageSchema } from "@/lib/pagination";
import { readSse } from "@/lib/sse";
import { redirectToLogin, responseErrorMessage } from "@/lib/unauthorized";
import { citationSchema, type Citation } from "@/features/chat/service/chat.service";

export const AGENT_STATUSES = ["draft", "active", "archived"] as const;
export type AgentStatus = (typeof AGENT_STATUSES)[number];

export const SEARCH_MODES = ["hybrid", "vector", "keyword"] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

/**
 * One immutable version of an agent's configuration. Editing publishes a new
 * one; a run records the version it ran, so what an answer was produced by stays
 * readable after the agent has moved on.
 */
export const agentVersionSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  version: z.number(),
  instructions: z.string(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  // numeric in Postgres, so it arrives as a string.
  temperature: z.coerce.number().nullable(),
  maxOutputTokens: z.number().nullable(),
  knowledgeBaseIds: z.array(z.string()).default([]),
  searchMode: z.string().default("hybrid"),
  topK: z.number().nullable(),
  similarityThreshold: z.coerce.number().nullable(),
  vectorWeight: z.coerce.number().nullable(),
  rerankProvider: z.string().nullable(),
  rerankModel: z.string().nullable(),
  groundedOnly: z.boolean().default(true),
  tools: z.array(z.string()).default([]),
  maxRounds: z.number().default(1),
  /** Null bounds a run by maxRounds alone. numeric arrives as a string. */
  creditCeiling: z.coerce.number().nullable().default(null),
  /** A flow, when this version is one. Null means a single prompt. */
  graph: z.unknown().nullable().default(null),
  approveWrites: z.boolean().default(true),
  createdBy: z.string().nullable(),
  createdAt: z.coerce.string(),
});

export const agentSchema = z.object({
  id: z.string(),
  organizationId: z.string(),
  projectId: z.string().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  currentVersion: z.number(),
  createdBy: z.string().nullable(),
  createdAt: z.coerce.string(),
  updatedAt: z.coerce.string(),
  /** The current version's configuration. Present on the detail endpoint only. */
  config: agentVersionSchema.nullable().optional(),
});

export const agentRunSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  agentVersionId: z.string(),
  projectId: z.string().nullable(),
  userId: z.string().nullable(),
  trigger: z.string(),
  status: z.string(),
  input: z.record(z.string(), z.unknown()).default({}),
  output: z.string().nullable(),
  error: z.string().nullable(),
  credits: z.coerce.number(),
  startedAt: z.coerce.string(),
  finishedAt: z.coerce.string().nullable(),
  createdAt: z.coerce.string(),
});

export const agentRunStepSchema = z.object({
  id: z.string(),
  runId: z.string(),
  seq: z.number(),
  kind: z.string(),
  status: z.string(),
  name: z.string().nullable(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  credits: z.coerce.number(),
  usageReference: z.string().nullable(),
  input: z.record(z.string(), z.unknown()).default({}),
  output: z.record(z.string(), z.unknown()).default({}),
  error: z.string().nullable(),
  startedAt: z.coerce.string(),
  finishedAt: z.coerce.string().nullable(),
});

export const agentsPageSchema = pageSchema(agentSchema);
export const agentRunsPageSchema = pageSchema(agentRunSchema);

export type Agent = z.infer<typeof agentSchema>;
export type AgentVersion = z.infer<typeof agentVersionSchema>;
export type AgentRun = z.infer<typeof agentRunSchema>;
export type AgentRunStep = z.infer<typeof agentRunStepSchema>;

/**
 * The whole of what one version configures.
 *
 * Sent complete on every publish, never as a patch: the backend writes an
 * immutable row, so a partial body would leave it ambiguous which of the
 * previous version's settings were meant to carry over.
 */
export interface AgentConfigInput {
  instructions: string;
  /** Null inherits the project override, then the workspace default. */
  model?: { provider: string; model: string } | null;
  temperature?: number | null;
  maxOutputTokens?: number | null;
  knowledgeBaseIds?: string[];
  searchMode?: SearchMode;
  topK?: number | null;
  similarityThreshold?: number | null;
  vectorWeight?: number | null;
  rerank?: { provider: string; model: string } | null;
  groundedOnly?: boolean;
  /** Which tools a run may call, by id. Validated by the backend. */
  tools?: string[];
  /** How many model-tool rounds one run may take. 1 means no loop. */
  maxRounds?: number;
  /** The most credits one run may spend before it is stopped. */
  creditCeiling?: number | null;
  /** A flow. Null keeps the version a single prompt. */
  graph?: unknown;
  /** Pause and ask a person before any tool that changes something runs. */
  approveWrites?: boolean;
}

export async function getAgents(workspaceId: string, limit = 50) {
  const response = await api.get(`workspaces/${workspaceId}/agents`, {
    searchParams: { limit, offset: 0 },
  });
  return agentsPageSchema.parse(await response.json());
}

export async function getAgent(
  workspaceId: string,
  agentId: string,
): Promise<Agent> {
  const response = await api.get(`workspaces/${workspaceId}/agents/${agentId}`);
  return agentSchema.parse(await response.json());
}

export async function getAgentVersions(
  workspaceId: string,
  agentId: string,
): Promise<AgentVersion[]> {
  const response = await api.get(
    `workspaces/${workspaceId}/agents/${agentId}/versions`,
  );
  return z.array(agentVersionSchema).parse(await response.json());
}

export async function getAgentRuns(workspaceId: string, agentId: string) {
  const response = await api.get(
    `workspaces/${workspaceId}/agents/${agentId}/runs`,
    { searchParams: { limit: 50, offset: 0 } },
  );
  return agentRunsPageSchema.parse(await response.json());
}

export async function getAgentRun(
  workspaceId: string,
  runId: string,
): Promise<AgentRun> {
  const response = await api.get(`workspaces/${workspaceId}/agent-runs/${runId}`);
  return agentRunSchema.parse(await response.json());
}

export async function getAgentRunSteps(
  workspaceId: string,
  runId: string,
): Promise<AgentRunStep[]> {
  const response = await api.get(
    `workspaces/${workspaceId}/agent-runs/${runId}/steps`,
  );
  return z.array(agentRunStepSchema).parse(await response.json());
}

export interface CreateAgentInput {
  name: string;
  description?: string | null;
  projectId?: string | null;
  config: AgentConfigInput;
}

export async function createAgent(
  workspaceId: string,
  input: CreateAgentInput,
): Promise<Agent> {
  const response = await api.post(`workspaces/${workspaceId}/agents`, {
    json: {
      name: input.name,
      description: input.description ?? null,
      projectId: input.projectId ?? null,
      config: configPayload(input.config),
    },
  });
  return agentSchema.parse(await response.json());
}

export interface UpdateAgentInput {
  name?: string;
  description?: string | null;
  projectId?: string | null;
  status?: AgentStatus;
}

export async function updateAgent(
  workspaceId: string,
  agentId: string,
  input: UpdateAgentInput,
): Promise<Agent> {
  const response = await api.patch(
    `workspaces/${workspaceId}/agents/${agentId}`,
    { json: input },
  );
  return agentSchema.parse(await response.json());
}

export async function publishAgentVersion(
  workspaceId: string,
  agentId: string,
  config: AgentConfigInput,
): Promise<AgentVersion> {
  const response = await api.post(
    `workspaces/${workspaceId}/agents/${agentId}/versions`,
    { json: configPayload(config) },
  );
  return agentVersionSchema.parse(await response.json());
}

export async function deleteAgent(
  workspaceId: string,
  agentId: string,
): Promise<void> {
  await api.delete(`workspaces/${workspaceId}/agents/${agentId}`);
}

/**
 * The configuration as the backend expects it — every field present, because a
 * published version is complete rather than a diff of the one before it.
 */
function configPayload(config: AgentConfigInput) {
  return {
    instructions: config.instructions,
    model: config.model ?? null,
    temperature: config.temperature ?? null,
    maxOutputTokens: config.maxOutputTokens ?? null,
    knowledgeBaseIds: config.knowledgeBaseIds ?? [],
    searchMode: config.searchMode ?? "hybrid",
    topK: config.topK ?? null,
    similarityThreshold: config.similarityThreshold ?? null,
    vectorWeight: config.vectorWeight ?? null,
    rerank: config.rerank ?? null,
    groundedOnly: config.groundedOnly ?? true,
    tools: config.tools ?? [],
    maxRounds: config.maxRounds ?? 1,
    creditCeiling: config.creditCeiling ?? null,
    graph: config.graph ?? null,
    approveWrites: config.approveWrites ?? true,
  };
}

/** What this deployment can give an agent. Fixed in the build, not per workspace. */
export const agentToolSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  /** True when the tool changes something outside Ragenta. */
  writes: z.boolean().default(false),
  /** An integration id an administrator must have configured, or null. */
  requires: z.string().nullable().default(null),
});

export type AgentToolInfo = z.infer<typeof agentToolSchema>;

export async function getAgentTools(
  workspaceId: string,
): Promise<AgentToolInfo[]> {
  const response = await api.get(`workspaces/${workspaceId}/agent-tools`);
  return z.array(agentToolSchema).parse(await response.json());
}

/**
 * Ask the server to stop a run that is generating.
 *
 * A request rather than an abort of the streaming fetch, for the same reason
 * chat does it this way: only the running request can save the partial answer,
 * so it is asked to finish early instead of being killed.
 */
export async function stopAgentRun(
  workspaceId: string,
  runId: string,
): Promise<void> {
  await api.post(`workspaces/${workspaceId}/agent-runs/${runId}/stop`);
}

/**
 * Answer what a paused flow asked for and carry on.
 *
 * The same stream shape a run opens, on the same run: it is one execution that
 * happened to wait for a person in the middle.
 */
export async function* resumeAgentRun(
  workspaceId: string,
  runId: string,
  answers: Record<string, string>,
  signal?: AbortSignal,
): AsyncGenerator<AgentStreamEvent> {
  const response = await fetch(
    `/api/v1/workspaces/${workspaceId}/agent-runs/${runId}/resume`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers }),
      signal,
    },
  );

  if (!response.ok) {
    if (response.status === 401) redirectToLogin();
    throw new Error(
      await responseErrorMessage(response, "The run could not be resumed."),
    );
  }

  yield* readEvents(response, signal);
}

export interface RunAgentInput {
  input: string;
  /** Narrows retrieval to specific documents. Empty means every document. */
  documentIds?: string[];
}

export type AgentStreamEvent =
  /** Arrives before any token. Its id is what the stop endpoint is addressed to. */
  | { type: "start"; runId: string }
  | { type: "phase"; phase: "retrieving" | "generating" }
  | { type: "citations"; citations: Citation[] }
  /** A knowledge base this version names has been deleted and was skipped. */
  | { type: "warning"; message: string }
  /** Which round of the tool loop is running. Absent for an agent with no tools. */
  | { type: "round"; round: number; of: number }
  | { type: "node_started"; nodeId: string; label: string; nodeType: string }
  | { type: "node_finished"; nodeId: string; label: string; ok: boolean }
  /** The flow is waiting for a person. The stream ends here until it resumes. */
  | {
      type: "awaiting_input";
      runId: string;
      nodeId: string;
      prompt: string;
      fields: string[];
    }
  | { type: "tool_started"; seq: number; name: string; arguments: string }
  | {
      type: "tool_finished";
      seq: number;
      name: string;
      ok: boolean;
      summary: string;
    }
  | { type: "delta"; text: string }
  | {
      type: "done";
      runId: string;
      status: "succeeded" | "failed" | "stopped" | "awaiting_input";
      credits: number;
      usage: { input: number; output: number };
    }
  | { type: "error"; message: string };

const streamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("start"), runId: z.string() }),
  z.object({
    type: z.literal("phase"),
    phase: z.enum(["retrieving", "generating"]),
  }),
  z.object({ type: z.literal("citations"), citations: z.array(citationSchema) }),
  z.object({ type: z.literal("warning"), message: z.string() }),
  z.object({
    type: z.literal("round"),
    round: z.number(),
    of: z.number(),
  }),
  z.object({
    type: z.literal("node_started"),
    nodeId: z.string(),
    label: z.string(),
    nodeType: z.string(),
  }),
  z.object({
    type: z.literal("node_finished"),
    nodeId: z.string(),
    label: z.string(),
    ok: z.boolean(),
  }),
  z.object({
    type: z.literal("awaiting_input"),
    runId: z.string(),
    nodeId: z.string(),
    prompt: z.string(),
    fields: z.array(z.string()),
  }),
  z.object({
    type: z.literal("tool_started"),
    seq: z.number(),
    name: z.string(),
    arguments: z.string(),
  }),
  z.object({
    type: z.literal("tool_finished"),
    seq: z.number(),
    name: z.string(),
    ok: z.boolean(),
    summary: z.string(),
  }),
  z.object({ type: z.literal("delta"), text: z.string() }),
  z.object({
    type: z.literal("done"),
    runId: z.string(),
    status: z.enum(["succeeded", "failed", "stopped", "awaiting_input"]),
    credits: z.number(),
    usage: z.object({ input: z.number(), output: z.number() }),
  }),
  z.object({ type: z.literal("error"), message: z.string() }),
]);

/**
 * One run, streamed.
 *
 * Raw fetch rather than the ky client: ky buffers a response before handing it
 * back, which would hold every token until the run was complete. Everything that
 * can refuse the run — no credits, a draft agent, a model outside the plan — is
 * refused before the stream opens, so a non-OK response here carries a normal
 * JSON error body.
 */
export async function* streamAgentRun(
  workspaceId: string,
  agentId: string,
  input: RunAgentInput,
  signal?: AbortSignal,
): AsyncGenerator<AgentStreamEvent> {
  const response = await fetch(
    `/api/v1/workspaces/${workspaceId}/agents/${agentId}/runs`,
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
      await responseErrorMessage(response, "The run could not be started."),
    );
  }

  yield* readEvents(response, signal);
}

/**
 * Decodes one run's frames.
 *
 * Both the parse and the schema check are non-fatal. A frame truncated by a
 * dropped connection, or an event type a later server adds, must not throw and
 * discard an answer that is already half on screen.
 */
async function* readEvents(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<AgentStreamEvent> {
  for await (const frame of readSse(response, signal)) {
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
