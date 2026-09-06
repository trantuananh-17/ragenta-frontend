import { queryOptions } from "@tanstack/react-query";

import {
  getAgent,
  getAgentRun,
  getAgentRunSteps,
  getAgentRuns,
  getAgentTools,
  getAgentVersions,
  getAgents,
} from "../service/agents.service";

export const agentKeys = {
  all: () => ["agents"] as const,
  list: (workspaceId: string) => [...agentKeys.all(), "list", workspaceId] as const,
  detail: (workspaceId: string, agentId: string) =>
    [...agentKeys.all(), "detail", workspaceId, agentId] as const,
  versions: (workspaceId: string, agentId: string) =>
    [...agentKeys.all(), "versions", workspaceId, agentId] as const,
  runs: (workspaceId: string, agentId: string) =>
    [...agentKeys.all(), "runs", workspaceId, agentId] as const,
  run: (workspaceId: string, runId: string) =>
    [...agentKeys.all(), "run", workspaceId, runId] as const,
  steps: (workspaceId: string, runId: string) =>
    [...agentKeys.all(), "steps", workspaceId, runId] as const,
  tools: (workspaceId: string) =>
    [...agentKeys.all(), "tools", workspaceId] as const,
};

export const agentOptions = {
  list: (workspaceId: string) =>
    queryOptions({
      queryKey: agentKeys.list(workspaceId),
      queryFn: () => getAgents(workspaceId),
    }),
  detail: (workspaceId: string, agentId: string) =>
    queryOptions({
      queryKey: agentKeys.detail(workspaceId, agentId),
      queryFn: () => getAgent(workspaceId, agentId),
    }),
  versions: (workspaceId: string, agentId: string) =>
    queryOptions({
      queryKey: agentKeys.versions(workspaceId, agentId),
      queryFn: () => getAgentVersions(workspaceId, agentId),
    }),
  runs: (workspaceId: string, agentId: string) =>
    queryOptions({
      queryKey: agentKeys.runs(workspaceId, agentId),
      queryFn: () => getAgentRuns(workspaceId, agentId),
    }),
  run: (workspaceId: string, runId: string) =>
    queryOptions({
      queryKey: agentKeys.run(workspaceId, runId),
      queryFn: () => getAgentRun(workspaceId, runId),
    }),
  steps: (workspaceId: string, runId: string) =>
    queryOptions({
      queryKey: agentKeys.steps(workspaceId, runId),
      queryFn: () => getAgentRunSteps(workspaceId, runId),
    }),
  // Fixed in the build rather than per workspace, so it is fetched once and
  // kept — a refetch could only ever return the same list.
  tools: (workspaceId: string) =>
    queryOptions({
      queryKey: agentKeys.tools(workspaceId),
      queryFn: () => getAgentTools(workspaceId),
      staleTime: Infinity,
    }),
};
