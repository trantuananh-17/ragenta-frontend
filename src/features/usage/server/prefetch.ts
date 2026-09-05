import "server-only";

import { getQueryClient } from "@/lib/get-query-client";
import { usageOptions } from "../options/usage.options";
import type { UsageParams } from "../params";

export async function prefetchUsage(workspaceId: string, params: UsageParams) {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(usageOptions.summary(workspaceId, params.days)),
    queryClient.prefetchQuery(usageOptions.records(workspaceId, params)),
  ]);
}
