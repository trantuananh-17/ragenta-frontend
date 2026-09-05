"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { usageOptions } from "../options/usage.options";
import type { UsageParams } from "../params";

export function useUsageSummarySuspense(workspaceId: string, days: number) {
  return useSuspenseQuery(usageOptions.summary(workspaceId, days));
}

export function useUsageRecordsSuspense(
  workspaceId: string,
  params: UsageParams,
) {
  return useSuspenseQuery(usageOptions.records(workspaceId, params));
}
