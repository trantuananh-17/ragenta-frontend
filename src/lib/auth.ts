import { cache } from "react";
import { redirect } from "next/navigation";

import { RAGENTA_API_URL, forwardedCookie } from "./server-fetch";

/**
 * The server-side session gate.
 *
 * `ragenta-backend` is the only source of identity, so this asks it rather than
 * decoding anything locally — a revoked session stops working here the moment it
 * stops working there. Everything below is UX: the backend re-checks membership
 * and role on every one of its own routes, and is what actually enforces them.
 */
const SESSION_PATH = "/v1/auth/get-session";

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
  emailVerified?: boolean | null;
}

export interface AppSession {
  user: SessionUser;
  session?: { activeOrganizationId?: string | null } | null;
}

/** Wrapped in `cache` so one render asks the backend once. */
export const getSession = cache(async (): Promise<AppSession | null> => {
  const cookie = await forwardedCookie();
  if (!cookie) return null;

  try {
    const response = await fetch(`${RAGENTA_API_URL}${SESSION_PATH}`, {
      headers: { cookie, accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) return null;

    // Better Auth answers 200 with a literal `null` body for an anonymous caller.
    const body = (await response.json()) as AppSession | null;
    if (!body?.user) return null;
    return body;
  } catch {
    // An identity service we cannot reach is not an authenticated caller.
    return null;
  }
});

export async function getCurrentUser(): Promise<SessionUser | null> {
  return (await getSession())?.user ?? null;
}

/**
 * Every signed-in page starts with this. The path the caller was on is carried
 * in `redirect` so signing in returns them to it rather than to the app root.
 */
export async function requireAuth(redirectTo?: string): Promise<AppSession> {
  const session = await getSession();
  if (!session) {
    redirect(
      redirectTo ? `/login?redirect=${encodeURIComponent(redirectTo)}` : "/login",
    );
  }
  return session;
}

/** Keeps a signed-in user off the sign-in and sign-up pages. */
export async function requireUnAuth(): Promise<void> {
  if (await getSession()) redirect("/");
}
