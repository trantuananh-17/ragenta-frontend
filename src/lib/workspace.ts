import { cache } from "react";
import { redirect } from "next/navigation";

import { RAGENTA_API_URL, forwardedCookie } from "./server-fetch";

/**
 * The active workspace, resolved on the server.
 *
 * A workspace is a Better Auth organization and every product route is
 * `/v1/workspaces/:workspaceId/...`, so a render has to know which one before it
 * can fetch anything. The cookie is a *preference*, never a credential — the
 * backend answers 404 for a workspace the caller is not a member of, so a forged
 * cookie buys nothing. That is also why it is validated against the caller's own
 * membership list here rather than trusted.
 */
export const ACTIVE_WORKSPACE_COOKIE = "ragenta_workspace";

export interface WorkspaceSummary {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  role: string;
  createdAt: string;
}

/** Wrapped in `cache` so the layout and the pages under it ask once. */
export const listWorkspaces = cache(async (): Promise<WorkspaceSummary[]> => {
  const cookie = await forwardedCookie();
  if (!cookie) return [];

  try {
    const response = await fetch(`${RAGENTA_API_URL}/v1/me/workspaces`, {
      headers: { cookie, accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { workspaces?: WorkspaceSummary[] };
    return body.workspaces ?? [];
  } catch {
    return [];
  }
});

/**
 * The workspace this render is about, or null when the caller has none yet.
 *
 * Order: the cookie if it names a workspace they are still a member of,
 * otherwise the most recently joined one. A stale cookie — a workspace they were
 * removed from, or one from another account on the same browser — falls through
 * to the fallback instead of producing a screen of 404s.
 */
export const getActiveWorkspace = cache(
  async (): Promise<WorkspaceSummary | null> => {
    const workspaces = await listWorkspaces();
    if (workspaces.length === 0) return null;

    try {
      const { cookies } = await import("next/headers");
      const preferred = (await cookies()).get(ACTIVE_WORKSPACE_COOKIE)?.value;
      const match = workspaces.find((workspace) => workspace.id === preferred);
      if (match) return match;
    } catch {
      // No request scope — fall through to the first membership.
    }

    return workspaces[0] ?? null;
  },
);

/**
 * Every workspace-scoped page starts with this. A user with no workspace is sent
 * to onboarding, which is what creates one — the app has nothing to show without.
 */
export async function requireWorkspace(): Promise<WorkspaceSummary> {
  const workspace = await getActiveWorkspace();
  if (!workspace) redirect("/onboarding");
  return workspace;
}

/** Roles that may spend the workspace's credits. `viewer` may only read. */
export function canContribute(role: string): boolean {
  return role === "owner" || role === "admin" || role === "member";
}

/** Roles that administer members, billing and workspace settings. */
export function canAdminister(role: string): boolean {
  return role === "owner" || role === "admin";
}
