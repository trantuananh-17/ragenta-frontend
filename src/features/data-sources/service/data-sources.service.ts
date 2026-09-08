import { z } from "zod";

import { api } from "@/lib/ky";

/**
 * A customer's own database, and the questions an agent may ask it.
 *
 * The shape this screen exists for: an agent **never writes SQL**. It picks a
 * named query and fills its parameters, and a named query only becomes callable
 * once somebody has approved it. This is where that approval happens.
 */
export const dataSourceTableSchema = z.object({
  schema: z.string(),
  name: z.string(),
  columns: z.array(
    z.object({ name: z.string(), type: z.string(), nullable: z.boolean() }),
  ),
});

export const dataQueryParameterSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string().default(""),
});

export const dataQuerySchema = z.object({
  id: z.string(),
  dataSourceId: z.string(),
  name: z.string(),
  description: z.string(),
  sql: z.string(),
  parameters: z.array(dataQueryParameterSchema),
  rowLimit: z.number(),
  origin: z.string(),
  /** Null means no agent can call it. This column is the whole gate. */
  approvedAt: z.coerce.string().nullable(),
  lastRunAt: z.coerce.string().nullable(),
  createdAt: z.coerce.string(),
});

export const dataSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  engine: z.string(),
  /** Masked. The connection string itself is never returned. */
  dsn: z.string(),
  enabled: z.boolean(),
  tables: z.array(dataSourceTableSchema),
  schemaCachedAt: z.coerce.string().nullable(),
  lastCheckedAt: z.coerce.string().nullable(),
  lastCheckOk: z.boolean().nullable(),
  lastCheckError: z.string().nullable(),
  createdAt: z.coerce.string(),
  queries: z.array(dataQuerySchema),
});

export type DataSource = z.infer<typeof dataSourceSchema>;
export type DataQuery = z.infer<typeof dataQuerySchema>;
export type DataQueryParameter = z.infer<typeof dataQueryParameterSchema>;

export async function getDataSources(workspaceId: string): Promise<DataSource[]> {
  const response = await api.get(`workspaces/${workspaceId}/data-sources`);
  const body = await response.json();
  return z.object({ sources: z.array(dataSourceSchema) }).parse(body).sources;
}

export async function saveDataSource(
  workspaceId: string,
  input: { id?: string; name: string; dsn?: string; enabled: boolean },
): Promise<void> {
  await api.put(`workspaces/${workspaceId}/data-sources`, { json: input });
}

export async function refreshSchema(workspaceId: string, sourceId: string): Promise<void> {
  await api.post(`workspaces/${workspaceId}/data-sources/${sourceId}/schema`);
}

export async function deleteDataSource(workspaceId: string, sourceId: string): Promise<void> {
  await api.delete(`workspaces/${workspaceId}/data-sources/${sourceId}`);
}

export const proposalSchema = z.object({
  name: z.string(),
  description: z.string(),
  sql: z.string(),
  parameters: z.array(dataQueryParameterSchema),
});

export type QueryProposal = z.infer<typeof proposalSchema>;

/** Proposes a query from plain language. Saves nothing — a person decides. */
export async function generateQuery(
  workspaceId: string,
  input: { dataSourceId: string; description: string },
): Promise<QueryProposal> {
  const response = await api.post(`workspaces/${workspaceId}/data-queries/generate`, {
    json: input,
    // Generation is a model call against a schema; it takes longer than a read.
    timeout: 60_000,
  });
  const body = await response.json();
  return z.object({ proposal: proposalSchema }).parse(body).proposal;
}

export const dryRunSchema = z.object({
  columns: z.array(z.string()),
  rows: z.array(z.array(z.unknown())),
  truncated: z.boolean(),
  durationMs: z.number(),
});

export type DryRunResult = z.infer<typeof dryRunSchema>;

/** Runs a statement once so somebody can see what it returns before approving. */
export async function dryRun(
  workspaceId: string,
  input: {
    dataSourceId: string;
    sql: string;
    parameters: unknown[];
    rowLimit: number;
  },
): Promise<DryRunResult> {
  const response = await api.post(`workspaces/${workspaceId}/data-queries/dry-run`, {
    json: input,
    timeout: 30_000,
  });
  return dryRunSchema.parse(await response.json());
}

export async function saveQuery(
  workspaceId: string,
  input: {
    id?: string;
    dataSourceId: string;
    name: string;
    description: string;
    sql: string;
    parameters: DataQueryParameter[];
    rowLimit: number;
    origin: "manual" | "generated";
    /** Only meaningful for a generated one, and only after it has been run. */
    approve?: boolean;
  },
): Promise<void> {
  await api.put(`workspaces/${workspaceId}/data-queries`, { json: input });
}

export async function deleteQuery(workspaceId: string, queryId: string): Promise<void> {
  await api.delete(`workspaces/${workspaceId}/data-queries/${queryId}`);
}
