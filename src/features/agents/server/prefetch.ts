import "server-only";

import { getQueryClient } from "@/lib/get-query-client";
import { agentOptions } from "../options/agents.options";

export async function prefetchAgents(workspaceId: string) {
  await getQueryClient().prefetchQuery(agentOptions.list(workspaceId));
}

export async function prefetchAgent(workspaceId: string, agentId: string) {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(agentOptions.detail(workspaceId, agentId)),
    queryClient.prefetchQuery(agentOptions.runs(workspaceId, agentId)),
  ]);
}

export async function prefetchAgentRun(workspaceId: string, runId: string) {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(agentOptions.run(workspaceId, runId)),
    queryClient.prefetchQuery(agentOptions.steps(workspaceId, runId)),
  ]);
}
