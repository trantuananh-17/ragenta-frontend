import { z } from "zod";

import { api } from "@/lib/ky";
import { pageSchema } from "@/lib/pagination";

/** What a workspace spent, grouped the way the ledger records it. */
export const usageBreakdownSchema = z.object({
  operation: z.string(),
  provider: z.string(),
  model: z.string(),
  calls: z.number(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  embeddingTokens: z.number(),
  credits: z.number(),
});

export const usageSummarySchema = z.object({
  since: z.coerce.string(),
  days: z.number(),
  breakdown: z.array(usageBreakdownSchema),
  totalCredits: z.number(),
});

export const usageRecordSchema = z.object({
  id: z.string(),
  projectId: z.string().nullable(),
  userId: z.string().nullable(),
  operation: z.string(),
  provider: z.string(),
  model: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  embeddingTokens: z.number(),
  credits: z.coerce.number(),
  pricingVersion: z.string().nullable(),
  reference: z.string(),
  createdAt: z.coerce.string(),
});

export const usageRecordsPageSchema = pageSchema(usageRecordSchema);

export type UsageSummary = z.infer<typeof usageSummarySchema>;
export type UsageBreakdown = z.infer<typeof usageBreakdownSchema>;
export type UsageRecord = z.infer<typeof usageRecordSchema>;

export const USAGE_OPERATIONS = [
  "chat",
  "embedding",
  "rerank",
  "ingestion",
  "agent",
] as const;

export async function getUsageSummary(
  workspaceId: string,
  days: number,
): Promise<UsageSummary> {
  const response = await api.get(`workspaces/${workspaceId}/usage`, {
    searchParams: { days },
  });
  return usageSummarySchema.parse(await response.json());
}

export async function getUsageRecords(
  workspaceId: string,
  params: { page: number; limit: number; operation?: string; projectId?: string },
) {
  const searchParams: Record<string, string | number> = {
    limit: params.limit,
    offset: Math.max(0, (params.page - 1) * params.limit),
  };
  if (params.operation) searchParams.operation = params.operation;
  if (params.projectId) searchParams.projectId = params.projectId;

  const response = await api.get(`workspaces/${workspaceId}/usage/records`, {
    searchParams,
  });
  return usageRecordsPageSchema.parse(await response.json());
}
