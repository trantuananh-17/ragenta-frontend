"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api-error";
import type { Citation } from "@/features/chat/service/chat.service";
import { agentKeys, agentOptions } from "../options/agents.options";
import {
  createAgent,
  deleteAgent,
  publishAgentVersion,
  resumeAgentRun,
  stopAgentRun,
  streamAgentRun,
  updateAgent,
  type AgentConfigInput,
  type AgentStreamEvent,
  type CreateAgentInput,
  type RunAgentInput,
  type UpdateAgentInput,
} from "../service/agents.service";

export function useAgentsSuspense(workspaceId: string) {
  return useSuspenseQuery(agentOptions.list(workspaceId));
}

export function useAgentSuspense(workspaceId: string, agentId: string) {
  return useSuspenseQuery(agentOptions.detail(workspaceId, agentId));
}

export function useAgentRunsSuspense(workspaceId: string, agentId: string) {
  return useSuspenseQuery(agentOptions.runs(workspaceId, agentId));
}

export function useAgentRunSuspense(workspaceId: string, runId: string) {
  return useSuspenseQuery(agentOptions.run(workspaceId, runId));
}

export function useAgentRunSteps(workspaceId: string, runId: string) {
  return useQuery(agentOptions.steps(workspaceId, runId));
}

export function useAgentVersions(workspaceId: string, agentId: string) {
  return useQuery(agentOptions.versions(workspaceId, agentId));
}

/** The tools this deployment can give an agent. */
export function useAgentTools(workspaceId: string) {
  return useQuery(agentOptions.tools(workspaceId));
}

export function useCreateAgent(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateAgentInput) => createAgent(workspaceId, input),
    onSuccess: async (agent) => {
      await queryClient.invalidateQueries({ queryKey: agentKeys.list(workspaceId) });
      // Created as a draft, so the detail screen is where the next step —
      // activating it — actually is.
      router.push(`/agents/${agent.id}`);
    },
    onError: async (error) => {
      toast.error("The agent could not be created", {
        description: await errorMessage(error),
      });
    },
  });
}

export function useUpdateAgent(workspaceId: string, agentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateAgentInput) => updateAgent(workspaceId, agentId, input),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: agentKeys.detail(workspaceId, agentId),
        }),
        queryClient.invalidateQueries({ queryKey: agentKeys.list(workspaceId) }),
      ]);
    },
    onError: async (error) => {
      toast.error("The agent could not be updated", {
        description: await errorMessage(error),
      });
    },
  });
}

/**
 * Publishing writes a new immutable version and makes it current. Runs already
 * in flight keep the version they started on, which is the whole reason the
 * configuration is versioned rather than edited in place.
 */
export function usePublishVersion(workspaceId: string, agentId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (config: AgentConfigInput) =>
      publishAgentVersion(workspaceId, agentId, config),
    onSuccess: async (version) => {
      toast.success(`Version ${version.version} published`);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: agentKeys.detail(workspaceId, agentId),
        }),
        queryClient.invalidateQueries({
          queryKey: agentKeys.versions(workspaceId, agentId),
        }),
      ]);
    },
    onError: async (error) => {
      toast.error("The version could not be published", {
        description: await errorMessage(error),
      });
    },
  });
}

export function useDeleteAgent(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (agentId: string) => deleteAgent(workspaceId, agentId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: agentKeys.list(workspaceId) });
      router.push("/agents");
    },
    onError: async (error) => {
      toast.error("The agent could not be deleted", {
        description: await errorMessage(error),
      });
    },
  });
}

/**
 * One thing the run did, as the timeline shows it while the run is still going.
 *
 * Tool calls and flow steps share the row shape because they read the same way
 * to whoever is watching: something started, and then it did or did not work.
 */
export interface TimelineEntry {
  kind: "tool" | "node";
  key: string;
  name: string;
  detail: string;
  /** Undefined while it is still running. */
  ok?: boolean;
  summary?: string;
}

/** What is on screen while a run is streaming, before any row exists for it. */
export interface StreamingRun {
  runId: string | null;
  output: string;
  citations: Citation[];
  phase: "retrieving" | "generating";
  warning: string | null;
  stopping: boolean;
  /** Null for an agent with no tools, which never reports a round. */
  round: { round: number; of: number } | null;
  timeline: TimelineEntry[];
  /** Set when a flow stopped at a step that asks a person. */
  awaiting: { nodeId: string; prompt: string; fields: string[] } | null;
}

/**
 * One run, streamed.
 *
 * The output accumulates in local state rather than in the query cache: a
 * `setQueryData` per token would re-render every subscriber of the run list on
 * every token. It reconciles once, when the stream finishes, by invalidating and
 * letting the server's own row win — that row carries the credits and the steps,
 * which the deltas do not.
 */
export function useRunAgent(workspaceId: string, agentId: string) {
  const queryClient = useQueryClient();
  const [streaming, setStreaming] = useState<StreamingRun | null>(null);
  const [pending, setPending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const runIdRef = useRef<string | null>(null);

  /**
   * Stop generating, without losing what is on screen. Asking the server is what
   * lets the run end the ordinary way — the partial output is written, `done`
   * arrives, and the reconcile below finds a real row. The abort stays as the
   * fallback for a run that has not been named yet.
   */
  const stop = useCallback(() => {
    const runId = runIdRef.current;
    if (!runId) {
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }

    setStreaming((current) => (current ? { ...current, stopping: true } : current));

    void stopAgentRun(workspaceId, runId).catch(() => {
      abortRef.current?.abort();
      abortRef.current = null;
    });
  }, [workspaceId]);

  /**
   * One event, applied to what is on screen.
   *
   * Shared by starting a run and resuming a paused one: a resumed flow emits
   * exactly the same events, and handling them twice would let the two drift.
   */
  const apply = useCallback((event: AgentStreamEvent) => {
        if (event.type === "start") {
          runIdRef.current = event.runId;
          setStreaming((current) =>
            current ? { ...current, runId: event.runId } : current,
          );
        } else if (event.type === "phase") {
          setStreaming((current) =>
            current ? { ...current, phase: event.phase } : current,
          );
        } else if (event.type === "citations") {
          setStreaming((current) =>
            current ? { ...current, citations: event.citations } : current,
          );
        } else if (event.type === "warning") {
          setStreaming((current) =>
            current ? { ...current, warning: event.message } : current,
          );
        } else if (event.type === "round") {
          setStreaming((current) =>
            current
              ? { ...current, round: { round: event.round, of: event.of } }
              : current,
          );
        } else if (event.type === "tool_started") {
          setStreaming((current) =>
            current
              ? {
                  ...current,
                  timeline: [
                    ...current.timeline,
                    {
                      kind: "tool",
                      key: `tool-${event.seq}-${event.name}`,
                      name: event.name,
                      detail: event.arguments,
                    },
                  ],
                }
              : current,
          );
        } else if (event.type === "tool_finished") {
          setStreaming((current) =>
            current ? { ...current, timeline: close(current.timeline, "tool", event.name, event.ok, event.summary) } : current,
          );
        } else if (event.type === "node_started") {
          setStreaming((current) =>
            current
              ? {
                  ...current,
                  timeline: [
                    ...current.timeline,
                    {
                      kind: "node",
                      key: `node-${event.nodeId}-${current.timeline.length}`,
                      name: event.label,
                      detail: event.nodeType,
                    },
                  ],
                }
              : current,
          );
        } else if (event.type === "node_finished") {
          setStreaming((current) =>
            current ? { ...current, timeline: close(current.timeline, "node", event.label, event.ok) } : current,
          );
        } else if (event.type === "awaiting_input") {
          setStreaming((current) =>
            current
              ? {
                  ...current,
                  awaiting: {
                    nodeId: event.nodeId,
                    prompt: event.prompt,
                    fields: event.fields,
                  },
                }
              : current,
          );
        } else if (event.type === "delta") {
          setStreaming((current) =>
            current ? { ...current, output: current.output + event.text } : current,
          );
        } else if (event.type === "error") {
          throw new Error(event.message);
        }
  }, []);


  const run = useCallback(
    async (input: RunAgentInput) => {
      if (pending) return;

      const controller = new AbortController();
      abortRef.current = controller;
      runIdRef.current = null;
      setPending(true);
      setStreaming({
        runId: null,
        output: "",
        citations: [],
        phase: "retrieving",
        warning: null,
        stopping: false,
        round: null,
        timeline: [],
        awaiting: null,
      });

      try {
        for await (const event of streamAgentRun(
          workspaceId,
          agentId,
          input,
          controller.signal,
        )) {
          apply(event);
        }
      } catch (error) {
        // An abort is the user pressing stop, not a failure.
        if (!controller.signal.aborted) {
          toast.error("The run stopped", { description: await errorMessage(error) });
        }
      } finally {
        abortRef.current = null;
        runIdRef.current = null;
        setPending(false);
        await queryClient.invalidateQueries({
          queryKey: agentKeys.runs(workspaceId, agentId),
        });
      }
    },
    [agentId, apply, pending, queryClient, workspaceId],
  );

  /**
   * Answer what a paused flow asked and carry on, into the same on-screen run.
   *
   * Deliberately not a fresh `run`: the output already on screen belongs to this
   * execution, and starting over would discard it and re-charge for it.
   */
  const resume = useCallback(
    async (runId: string, answers: Record<string, string>) => {
      if (pending) return;

      const controller = new AbortController();
      abortRef.current = controller;
      setPending(true);
      setStreaming((current) => (current ? { ...current, awaiting: null } : current));

      try {
        for await (const event of resumeAgentRun(
          workspaceId,
          runId,
          answers,
          controller.signal,
        )) {
          apply(event);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          toast.error("The run stopped", { description: await errorMessage(error) });
        }
      } finally {
        abortRef.current = null;
        setPending(false);
        await queryClient.invalidateQueries({
          queryKey: agentKeys.runs(workspaceId, agentId),
        });
      }
    },
    [agentId, apply, pending, queryClient, workspaceId],
  );

  return { run, resume, stop, streaming, pending, clear: () => setStreaming(null) };
}

/**
 * Marks the most recent unfinished entry of a kind as done.
 *
 * Matched on the name as well, because a flow can run two steps with the same
 * label and an entry filled in against the wrong one would be worse than one
 * that never fills in at all.
 */
function close(
  timeline: TimelineEntry[],
  kind: TimelineEntry["kind"],
  name: string,
  ok: boolean,
  summary?: string,
): TimelineEntry[] {
  const index = timeline.findLastIndex(
    (entry) => entry.kind === kind && entry.name === name && entry.ok === undefined,
  );
  if (index < 0) return timeline;
  return timeline.map((entry, position) =>
    position === index ? { ...entry, ok, summary } : entry,
  );
}
