/**
 * What a 401 does in the browser, in one place.
 *
 * Every call the app makes goes through either the ky client or one of the two
 * raw `fetch` calls that cannot use it (chat streaming and document upload).
 * Without this, a session that expired mid-upload would leave the user reading
 * "Upload failed (401)" on a page that can no longer load anything, while the
 * same expiry on any other call bounced them to the gate.
 */
export function redirectToLogin(): void {
  if (typeof window === "undefined") return;

  const here = window.location.pathname + window.location.search;
  const safe = here.startsWith("/") && !here.startsWith("//") && here !== "/login";

  window.location.href = safe
    ? `/login?redirect=${encodeURIComponent(here)}`
    : "/login";
}

/** The backend's error envelope: `{ error: { code, message }, requestId }`. */
export async function responseErrorMessage(
  response: Response,
  fallback: string,
): Promise<string> {
  const body = (await response.json().catch(() => null)) as {
    error?: { message?: string };
  } | null;
  return body?.error?.message ?? fallback;
}
