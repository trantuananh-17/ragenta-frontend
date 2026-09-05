"use client";

import { createContext, useContext } from "react";

import type { WorkspaceSummary } from "@/lib/workspace";

/**
 * The workspace this part of the tree is about, resolved once on the server and
 * handed down rather than re-fetched per component.
 *
 * The role travels with it because nearly every screen has an affordance that
 * depends on it — a viewer must not be shown an upload button that the backend
 * would refuse. The backend is what enforces this; the context only decides what
 * to render.
 */
interface WorkspaceContextValue {
  workspace: WorkspaceSummary;
  workspaces: WorkspaceSummary[];
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  workspace,
  workspaces,
  children,
}: WorkspaceContextValue & { children: React.ReactNode }) {
  return (
    <WorkspaceContext value={{ workspace, workspaces }}>
      {children}
    </WorkspaceContext>
  );
}

export function useWorkspace(): WorkspaceContextValue {
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
