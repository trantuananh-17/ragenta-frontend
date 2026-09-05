import { queryOptions } from "@tanstack/react-query";

import { getUsageRecords, getUsageSummary } from "../service/usage.service";
import type { UsageParams } from "../params";

export const usageKeys = {
  all: () => ["usage"] as const,
  summary: (workspaceId: string, days: number) =>
    [...usageKeys.all(), "summary", workspaceId, days] as const,
  records: (workspaceId: string, params: UsageParams) =>
    [...usageKeys.all(), "records", workspaceId, params] as const,
};

export const usageOptions = {
  summary: (workspaceId: string, days: number) =>
    queryOptions({
      queryKey: usageKeys.summary(workspaceId, days),
      queryFn: () => getUsageSummary(workspaceId, days),
    }),
  records: (workspaceId: string, params: UsageParams) =>
    queryOptions({
      queryKey: usageKeys.records(workspaceId, params),
      queryFn: () =>
        getUsageRecords(workspaceId, {
          page: params.page,
          limit: params.limit,
          operation: params.operation || undefined,
        }),
    }),
};
