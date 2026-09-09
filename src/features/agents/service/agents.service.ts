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

export const MEMORY_SCOPES = ["agent", "user"] as const;
export type MemoryScope = (typeof MEMORY_SCOPES)[number];

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
  memoryEnabled: z.boolean().default(false),
  memoryScope: z.enum(["agent", "user"]).default("agent"),
  memoryTopK: z.number().default(5),
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
  /** Whether this version remembers anything between runs. Off by default. */
  memoryEnabled?: boolean;
  /** `agent` shares what it learned; `user` keeps each person's to themselves. */
  memoryScope?: MemoryScope;
  /** How many memories one run may recall. */
  memoryTopK?: number;
}

/**
 * The current version, as the input that would republish it unchanged.
 *
 * For anything that changes one setting and publishes — the flow canvas, say.
 * Assembling that payload field by field at each call site is how a setting
 * nobody was thinking about gets quietly reset to its default on the next
 * publish, which is the same shape of bug as promoting somebody dropping their
 * other roles.
 */
export function configFrom(version: AgentVersion): AgentConfigInput {
  return {
    instructions: version.instructions,
    model:
      version.provider && version.model
        ? { provider: version.provider, model: version.model }
        : null,
    temperature: version.temperature,
    maxOutputTokens: version.maxOutputTokens,
    knowledgeBaseIds: version.knowledgeBaseIds,
    searchMode: version.searchMode as SearchMode,
    topK: version.topK,
    similarityThreshold: version.similarityThreshold,
    vectorWeight: version.vectorWeight,
    rerank:
      version.rerankProvider && version.rerankModel
        ? { provider: version.rerankProvider, model: version.rerankModel }
        : null,
    groundedOnly: version.groundedOnly,
    tools: version.tools,
    maxRounds: version.maxRounds,
    creditCeiling: version.creditCeiling,
    graph: version.graph,
    approveWrites: version.approveWrites,
    memoryEnabled: version.memoryEnabled,
    memoryScope: version.memoryScope,
    memoryTopK: version.memoryTopK,
  };
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
    memoryEnabled: config.memoryEnabled ?? false,
    memoryScope: config.memoryScope ?? "agent",
    memoryTopK: config.memoryTopK ?? 5,
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
  /**
   * Images this run is about, uploaded through the same endpoint chat uses.
   *
   * A single-prompt agent sends them to the model, so it needs one that can
   * see; a flow reaches them through its own steps and does not.
   */
  attachmentIds?: string[];
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

/**
 * An agent somebody can start from instead of from an empty box.
 *
 * Each tool arrives marked `available` or not, because a template asks for tools
 * this deployment may not be able to run: applying it drops those rather than
 * refusing, and the screen says so before the choice rather than after it
 * (ADR-057).
 */
export const agentTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  summary: z.string(),
  description: z.string(),
  instructions: z.string(),
  tools: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      available: z.boolean(),
      requires: z.string().nullable(),
    }),
  ),
  needsKnowledgeBase: z.boolean(),
  memory: z.object({
    enabled: z.boolean(),
    scope: z.enum(MEMORY_SCOPES),
  }),
  maxRounds: z.number(),
  groundedOnly: z.boolean(),
});

export type AgentTemplate = z.infer<typeof agentTemplateSchema>;

export async function getAgentTemplates(
  workspaceId: string,
): Promise<AgentTemplate[]> {
  const response = await api.get(`workspaces/${workspaceId}/agent-templates`);
  const body = z
    .object({ templates: z.array(agentTemplateSchema) })
    .parse(await response.json());
  return body.templates;
}

export interface CreateFromTemplateInput {
  templateId: string;
  name?: string;
  projectId?: string | null;
  knowledgeBaseIds?: string[];
}

const createdFromTemplateSchema = z.object({
  agent: agentSchema,
  /** Tools the template asked for that this deployment cannot run. */
  droppedTools: z.array(z.string()),
  template: z.string(),
});

export type CreatedFromTemplate = z.infer<typeof createdFromTemplateSchema>;

export async function createAgentFromTemplate(
  workspaceId: string,
  input: CreateFromTemplateInput,
): Promise<CreatedFromTemplate> {
  const response = await api.post(`workspaces/${workspaceId}/agents/from-template`, {
    json: {
      templateId: input.templateId,
      name: input.name,
      projectId: input.projectId ?? null,
      knowledgeBaseIds: input.knowledgeBaseIds ?? [],
    },
  });
  return createdFromTemplateSchema.parse(await response.json());
}

export const TRIGGER_KINDS = ["webhook", "schedule"] as const;
export type TriggerKind = (typeof TRIGGER_KINDS)[number];

/**
 * What starts a run when nobody is watching.
 *
 * A webhook's secret is never in this shape — it is hashed on the server and
 * returned once, by the call that created it. `secretHint` is the few characters
 * that let somebody tell two webhooks apart, and nothing more.
 */
export const triggerSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  kind: z.enum(TRIGGER_KINDS),
  name: z.string(),
  enabled: z.boolean(),
  input: z.string(),
  cron: z.string().nullable(),
  timezone: z.string(),
  secretHint: z.string().nullable(),
  nextRunAt: z.coerce.string().nullable(),
  lastFiredAt: z.coerce.string().nullable(),
  failureCount: z.number(),
  lastError: z.string().nullable(),
  createdAt: z.coerce.string(),
});

export type Trigger = z.infer<typeof triggerSchema>;

export interface SaveTriggerInput {
  kind: TriggerKind;
  name: string;
  enabled: boolean;
  input: string;
  cron?: string;
  timezone: string;
}

export async function getTriggers(
  workspaceId: string,
  agentId: string,
): Promise<Trigger[]> {
  const response = await api.get(
    `workspaces/${workspaceId}/agents/${agentId}/triggers`,
  );
  const body = z
    .object({ triggers: z.array(triggerSchema) })
    .parse(await response.json());
  return body.triggers;
}

const createdTriggerSchema = z.object({
  trigger: triggerSchema.optional(),
  /** A webhook's secret, shown once and never again. */
  secret: z.string().optional(),
});

export type CreatedTrigger = z.infer<typeof createdTriggerSchema>;

export async function createTrigger(
  workspaceId: string,
  agentId: string,
  input: SaveTriggerInput,
): Promise<CreatedTrigger> {
  const response = await api.post(
    `workspaces/${workspaceId}/agents/${agentId}/triggers`,
    { json: input },
  );
  return createdTriggerSchema.parse(await response.json());
}

export async function updateTrigger(
  workspaceId: string,
  triggerId: string,
  input: SaveTriggerInput,
): Promise<Trigger> {
  const response = await api.put(`workspaces/${workspaceId}/triggers/${triggerId}`, {
    json: input,
  });
  const body = z.object({ trigger: triggerSchema }).parse(await response.json());
  return body.trigger;
}

export async function deleteTrigger(
  workspaceId: string,
  triggerId: string,
): Promise<void> {
  await api.delete(`workspaces/${workspaceId}/triggers/${triggerId}`);
}

/**
 * The URL a third party POSTs to fire a webhook.
 *
 * Built from the browser's own origin rather than from a configured base, the
 * same way the widget snippet is: the caller reaches this app, and this app
 * forwards to the backend — so the URL somebody copies is the one that works.
 */
export function webhookUrl(triggerId: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}/api/v1/hooks/${triggerId}`;
}

/**
 * One field that differs between two versions.
 *
 * `kind` decides how the screen renders it: a brief is long enough to want its
 * own block, a tool list reads as added and removed items, and everything else
 * is a before and an after on one line.
 */
export const fieldChangeSchema = z.object({
  field: z.string(),
  label: z.string(),
  kind: z.enum(["text", "value", "list"]),
  before: z.unknown(),
  after: z.unknown(),
});

export type FieldChange = z.infer<typeof fieldChangeSchema>;

export const versionDiffSchema = z.object({
  from: z.object({ version: z.number(), createdAt: z.coerce.string() }),
  to: z.object({ version: z.number(), createdAt: z.coerce.string() }),
  changes: z.array(fieldChangeSchema),
});

export type VersionDiff = z.infer<typeof versionDiffSchema>;

export async function getVersionDiff(
  workspaceId: string,
  agentId: string,
  from: number,
  to: number,
): Promise<VersionDiff> {
  const response = await api.get(
    `workspaces/${workspaceId}/agents/${agentId}/versions/diff`,
    { searchParams: { from, to } },
  );
  return versionDiffSchema.parse(await response.json());
}

/**
 * Goes back to an earlier version by publishing it again.
 *
 * The response names the new version rather than the restored one, because that
 * is what runs from now on — and saying so is what stops somebody expecting the
 * number to go backwards.
 */
export async function restoreVersion(
  workspaceId: string,
  agentId: string,
  version: number,
): Promise<{ publishedAs: number; restoredFrom: number }> {
  const response = await api.post(
    `workspaces/${workspaceId}/agents/${agentId}/versions/${version}/restore`,
  );
  const body = z
    .object({
      version: agentVersionSchema.nullish(),
      restoredFrom: z.number(),
    })
    .parse(await response.json());
  return {
    publishedAs: body.version?.version ?? 0,
    restoredFrom: body.restoredFrom,
  };
}

/**
 * One input, run against several versions.
 *
 * The answer is run ids rather than answers: each version is an ordinary queued
 * run, so the comparison is watched by polling the runs rather than by holding
 * several streams open at once.
 */
export interface CompareVersionsInput {
  input: string;
  versions: number[];
}

const comparisonStartedSchema = z.object({
  comparisonId: z.string(),
  runs: z.array(z.object({ runId: z.string(), version: z.number() })),
});

export type ComparisonStarted = z.infer<typeof comparisonStartedSchema>;

export async function compareVersions(
  workspaceId: string,
  agentId: string,
  input: CompareVersionsInput,
): Promise<ComparisonStarted> {
  const response = await api.post(
    `workspaces/${workspaceId}/agents/${agentId}/compare`,
    { json: input },
  );
  return comparisonStartedSchema.parse(await response.json());
}

/** A comparison's runs, each carrying the version number it ran. */
export const comparisonRunSchema = agentRunSchema.extend({
  /** Null only if the version row was somehow unreadable; every run has one. */
  version: z.number().nullable(),
});

export type ComparisonRun = z.infer<typeof comparisonRunSchema>;

const comparisonSchema = z.object({
  comparisonId: z.string(),
  runs: z.array(comparisonRunSchema),
});

export type Comparison = z.infer<typeof comparisonSchema>;

export async function getComparison(
  workspaceId: string,
  comparisonId: string,
): Promise<Comparison> {
  const response = await api.get(`workspaces/${workspaceId}/comparisons/${comparisonId}`);
  return comparisonSchema.parse(await response.json());
}

/**
 * `POST /workspaces/:id/agents/generate-graph` — a flow drafted from a sentence.
 *
 * The backend answers a graph **or** the reasons what the model produced is not
 * one, and never a half-valid graph: it runs the proposal through the same
 * checks the publish path uses. So this returns a union and the caller has to
 * look, which is the point.
 */
const generatedGraphSchema = z.union([
  // The shape is read loosely here for the reason `graph` is `z.unknown()` on
  // the version above: the backend has already parsed it against the schema the
  // engine runs and rejected anything that failed, so a second, weaker copy of
  // those rules on the client could only ever disagree with the real one.
  z.object({ graph: z.object({ nodes: z.record(z.string(), z.unknown()) }) }),
  z.object({ errors: z.array(z.string()) }),
]);

export type GeneratedGraph = z.infer<typeof generatedGraphSchema>;

export async function generateGraph(
  workspaceId: string,
  prompt: string,
): Promise<GeneratedGraph> {
  const response = await api.post(`workspaces/${workspaceId}/agents/generate-graph`, {
    json: { prompt },
    // A model writing a dozen nodes takes longer than the client default, and a
    // timeout here reads to the user as a refusal rather than as impatience.
    timeout: 120_000,
  });
  return generatedGraphSchema.parse(await response.json());
}
