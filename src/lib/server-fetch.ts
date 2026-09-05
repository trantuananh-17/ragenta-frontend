/**
 * Server-context helpers for reaching `ragenta-backend`.
 *
 * `next/headers` is imported dynamically, never at the top of the module: the
 * ky client below imports this file and is itself imported from client
 * components, and a static import would pull a server-only module into the
 * browser bundle.
 */

/** Backend base URL. Server-side only — the browser talks to this app's proxy. */
export const RAGENTA_API_URL = (
  process.env.RAGENTA_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

/**
 * The caller's own credential, replayed upstream.
 *
 * `ragenta-backend` authenticates the Better Auth session cookie directly —
 * there is no token to exchange, so a server-side call carries the browser's
 * cookie and nothing else. Never mint or cache a credential here: a stale one
 * would outlive the session it came from.
 */
export async function forwardedCookie(): Promise<string | undefined> {
  if (typeof window !== "undefined") return undefined;
  try {
    const { cookies } = await import("next/headers");
    const all = (await cookies()).getAll();
    if (all.length === 0) return undefined;
    return all.map((entry) => `${entry.name}=${entry.value}`).join("; ");
  } catch {
    // Outside a request scope (a build-time render, say) there is no caller.
    return undefined;
  }
}
