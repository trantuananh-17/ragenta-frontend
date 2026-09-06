"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, GitBranch } from "lucide-react";

import {
  EntityContainer,
  EntityEmptyView,
  EntityHeader,
} from "@/components/entity-components";
import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import { canContribute } from "@/lib/workspace";
import { useAgentsSuspense } from "../hooks/agents.hook";
import { CreateAgentDialog } from "./create-agent-dialog";

/** draft is neutral, active is the only state that can actually run. */
export function AgentStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge
      tone={status === "active" ? "success" : status === "archived" ? "danger" : "neutral"}
    >
      {status}
    </StatusBadge>
  );
}

export function AgentsScreen() {
  const { workspace } = useWorkspace();
  const { data } = useAgentsSuspense(workspace.id);
  const [creating, setCreating] = useState(false);
  const mayCreate = canContribute(workspace.role);

  return (
    <>
      <EntityContainer
        header={
          <EntityHeader
            title="Agents"
            description="A saved brief, model and set of knowledge bases that anyone in the workspace can run. Each edit publishes a version, and every run records the one it ran."
            newButtonLabel="New agent"
            disabled={!mayCreate}
            onNew={() => setCreating(true)}
          />
        }
      >
        {data.items.length === 0 ? (
          <EntityEmptyView
            icon={<Bot />}
            title="No agents yet"
            message="An agent answers the same kind of question the same way every time, without anyone re-typing the brief."
            newLabel="New agent"
            disabled={!mayCreate}
            onNew={mayCreate ? () => setCreating(true) : undefined}
          />
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((agent) => (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="group rounded-lg border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="truncate font-medium group-hover:text-primary">
                    {agent.name}
                  </h2>
                  <Bot className="size-4 shrink-0 text-muted-foreground" />
                </div>
                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                  {agent.description || "No description."}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <AgentStatusBadge status={agent.status} />
                  <span className="flex items-center gap-1 tabular-nums">
                    <GitBranch className="size-3.5" />v{agent.currentVersion}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </EntityContainer>

      <CreateAgentDialog
        workspaceId={workspace.id}
        open={creating}
        onOpenChange={setCreating}
      />
    </>
  );
}

export function AgentsLoading() {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((card) => (
        <Skeleton key={card} className="h-36 rounded-lg" />
      ))}
    </div>
  );
}

export function AgentsError() {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
      Agents could not be loaded.
    </div>
  );
}
