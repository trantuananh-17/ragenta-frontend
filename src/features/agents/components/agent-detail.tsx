"use client";

import Link from "next/link";
import { useState } from "react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DetailSection, DetailShell } from "@/components/detail-shell";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import { formatCredits, formatDateTime } from "@/lib/format";
import { canContribute } from "@/lib/workspace";
import {
  useAgentRunsSuspense,
  useAgentSuspense,
  useAgentTools,
  useDeleteAgent,
  usePublishVersion,
  useUpdateAgent,
} from "../hooks/agents.hook";
import { FlowEditor } from "../flow/flow-editor";
import { emptyGraph, type AgentGraph } from "../flow/graph-model";
import { AgentConfigForm } from "./agent-config-form";
import { AgentRunPanel } from "./agent-run-panel";
import { AgentStatusBadge } from "./agents-list";
import { RunStatusBadge } from "./run-detail";

export function AgentDetail({ agentId }: { agentId: string }) {
  const { workspace } = useWorkspace();
  const { data: agent } = useAgentSuspense(workspace.id, agentId);
  const { data: runs } = useAgentRunsSuspense(workspace.id, agentId);
  const update = useUpdateAgent(workspace.id, agentId);
  const publish = usePublishVersion(workspace.id, agentId);
  const remove = useDeleteAgent(workspace.id);
  const { data: tools } = useAgentTools(workspace.id);
  const [confirming, setConfirming] = useState(false);

  const stored = (agent.config?.graph ?? null) as AgentGraph | null;
  // Held locally while it is being edited, because a graph is dragged into shape
  // over many small changes and publishing a version per drag would be absurd.
  const [draft, setDraft] = useState<AgentGraph | null>(stored);

  const mayEdit = canContribute(workspace.role);
  const active = agent.status === "active";
  const isFlow = stored !== null;

  return (
    <DetailShell>
      <PageHeader
        back={{ href: "/agents", label: "Agents" }}
        title={agent.name}
        description={agent.description}
        badges={
          <>
            <AgentStatusBadge status={agent.status} />
            <span className="text-xs text-muted-foreground tabular-nums">
              version {agent.currentVersion}
            </span>
          </>
        }
        actions={
          mayEdit && (
            <>
              <Button
                variant="outline"
                disabled={update.isPending || agent.status === "archived"}
                onClick={() =>
                  update.mutate({ status: active ? "draft" : "active" })
                }
              >
                {active ? "Deactivate" : "Activate"}
              </Button>
              <Button variant="outline" onClick={() => setConfirming(true)}>
                Delete
              </Button>
            </>
          )
        }
      />

      <Tabs defaultValue="run">
        <TabsList>
          <TabsTrigger value="run">Run</TabsTrigger>
          <TabsTrigger value="configuration">Configuration</TabsTrigger>
          <TabsTrigger value="flow">
            Flow
            {isFlow && <span className="ml-1.5 text-muted-foreground">on</span>}
          </TabsTrigger>
          <TabsTrigger value="history">
            History
            {runs.total > 0 && (
              <span className="ml-1.5 text-muted-foreground tabular-nums">
                {runs.total}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="run" className="mt-4">
          <AgentRunPanel
            workspaceId={workspace.id}
            agent={agent}
            disabled={!mayEdit}
          />
        </TabsContent>

        <TabsContent value="configuration" className="mt-4">
          <DetailSection
            title={`Version ${agent.currentVersion}`}
            description="Saving publishes a new version. Runs already in flight keep the one they started on, and every past run stays readable against the version it actually ran."
          >
            <AgentConfigForm
              workspaceId={workspace.id}
              version={agent.config ?? null}
              disabled={!mayEdit}
              pending={publish.isPending}
              submitLabel="Publish new version"
              onSubmit={(config) => publish.mutate(config)}
            />
          </DetailSection>
        </TabsContent>

        <TabsContent value="flow" className="mt-4">
          <DetailSection
            title="Flow"
            description="Steps the agent runs in order, branching where you say. A flow replaces the single prompt on the Configuration tab; publishing one is what turns this agent into a flow."
            actions={
              draft ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!mayEdit}
                  onClick={() => setDraft(null)}
                >
                  Discard flow
                </Button>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!mayEdit}
                  onClick={() => setDraft(emptyGraph())}
                >
                  Start a flow
                </Button>
              )
            }
          >
            {draft ? (
              <FlowEditor
                graph={draft}
                toolIds={(tools ?? []).map((tool) => tool.id)}
                disabled={!mayEdit}
                pending={publish.isPending}
                onChange={setDraft}
                onPublish={() =>
                  agent.config &&
                  publish.mutate({
                    instructions: agent.config.instructions,
                    model:
                      agent.config.provider && agent.config.model
                        ? {
                            provider: agent.config.provider,
                            model: agent.config.model,
                          }
                        : null,
                    temperature: agent.config.temperature,
                    maxOutputTokens: agent.config.maxOutputTokens,
                    knowledgeBaseIds: agent.config.knowledgeBaseIds,
                    searchMode: agent.config.searchMode as "hybrid",
                    topK: agent.config.topK,
                    groundedOnly: agent.config.groundedOnly,
                    tools: agent.config.tools,
                    maxRounds: agent.config.maxRounds,
                    creditCeiling: agent.config.creditCeiling,
                    graph: draft,
                  })
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                This agent answers with one prompt. Start a flow when it needs to do
                several things in order — search, then decide, then ask someone —
                rather than one.
              </p>
            )}
          </DetailSection>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {runs.items.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              This agent has not been run yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Started</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Trigger</TableHead>
                    <TableHead className="text-right">Credits</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {runs.items.map((run) => (
                    <TableRow key={run.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(run.startedAt)}
                      </TableCell>
                      <TableCell>
                        <RunStatusBadge status={run.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {run.trigger}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatCredits(run.credits)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/agents/${agentId}/runs/${run.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          Open
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`Delete "${agent.name}"?`}
        description="Its versions and its whole run history go with it. What each run cost stays in the usage ledger."
        confirmLabel="Delete agent"
        destructive
        onConfirm={() => remove.mutate(agentId)}
      />
    </DetailShell>
  );
}

export function AgentLoading() {
  return (
    <DetailShell>
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-64 rounded-lg" />
    </DetailShell>
  );
}

export function AgentError() {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
      This agent could not be loaded.
    </div>
  );
}
