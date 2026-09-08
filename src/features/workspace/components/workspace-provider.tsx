"use client";

import { createContext, useContext, useMemo } from "react";

import type { WorkspaceSummary } from "@/lib/workspace";

/**
 * The workspace this part of the tree is about, resolved once on the server and
 * handed down rather than re-fetched per component.
 *
 * The caller's **permissions** travel with it because nearly every screen has an
 * affordance that depends on them — a viewer must not be shown an upload button
 * the backend would refuse. They come from the backend rather than from the role
 * string: since roles became composable, deriving them from the name is a guess
 * that is simply wrong for any role somebody wrote themselves (ADR-046).
 *
 * The backend is what enforces this; the context only decides what to render.
 */
interface WorkspaceContextValue {
  workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
  permissions: string[];
}

interface WorkspaceContext extends WorkspaceContextValue {
  /** Whether the caller holds this permission. Affordance only. */
  can: (permission: string) => boolean;
}

const WorkspaceContext = createContext<WorkspaceContext | null>(null);

export function WorkspaceProvider({
  workspace,
  workspaces,
  permissions,
  children,
}: WorkspaceContextValue & { children: React.ReactNode }) {
  const value = useMemo(() => {
    const held = new Set(permissions);
    return {
      workspace,
      workspaces,
      permissions,
      can: (permission: string) => held.has(permission),
    };
  }, [workspace, workspaces, permissions]);

  return <WorkspaceContext value={value}>{children}</WorkspaceContext>;
}

export function useWorkspace(): WorkspaceContext {
  const value = useContext(WorkspaceContext);
  if (!value) {
    throw new Error("useWorkspace must be used inside the app shell.");
  }
  return value;
}

/** The active workspace id — what every workspace-scoped query is keyed on. */
export function useWorkspaceId(): string {
  return useWorkspace().workspace.id;
}

export function useWorkspaceRole(): string {
  return useWorkspace().workspace.role;
}

/** The affordance check every screen uses. `can("agent.create")`. */
export function useCan(): (permission: string) => boolean {
  return useWorkspace().can;
}
