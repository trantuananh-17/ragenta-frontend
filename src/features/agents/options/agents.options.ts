import { queryOptions } from "@tanstack/react-query";

import {
  getAgent,
  getAgentRun,
  getAgentRunSteps,
  getAgentRuns,
  getAgentTemplates,
  getAgentTools,
  getAgentVersions,
  getAgents,
  getTriggers,
  getVersionDiff,
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
  templates: (workspaceId: string) =>
    [...agentKeys.all(), "templates", workspaceId] as const,
  triggers: (workspaceId: string, agentId: string) =>
    [...agentKeys.all(), "triggers", workspaceId, agentId] as const,
  diff: (workspaceId: string, agentId: string, from: number, to: number) =>
    [...agentKeys.all(), "diff", workspaceId, agentId, from, to] as const,
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
  // Compiled into the backend, but each one's tools are marked available against
  // this workspace's connections — so it is per workspace and not cached forever.
  templates: (workspaceId: string) =>
    queryOptions({
      queryKey: agentKeys.templates(workspaceId),
      queryFn: () => getAgentTemplates(workspaceId),
    }),
  triggers: (workspaceId: string, agentId: string) =>
    queryOptions({
      queryKey: agentKeys.triggers(workspaceId, agentId),
      queryFn: () => getTriggers(workspaceId, agentId),
    }),
  // Two immutable versions, so the answer cannot change. Kept rather than
  // refetched every time somebody flips back to a pair they already looked at.
  diff: (workspaceId: string, agentId: string, from: number, to: number) =>
    queryOptions({
      queryKey: agentKeys.diff(workspaceId, agentId, from, to),
      queryFn: () => getVersionDiff(workspaceId, agentId, from, to),
      staleTime: Infinity,
    }),
};
