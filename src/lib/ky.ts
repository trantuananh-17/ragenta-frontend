import ky from "ky";

import { RAGENTA_API_URL, forwardedCookie } from "./server-fetch";
import { redirectToLogin } from "./unauthorized";

/**
 * `ragenta-backend` — identity, workspaces, projects, knowledge bases, chat,
 * billing and usage.
 *
 * Dual-mode. In the browser the base URL is relative so the call goes through
 * this app's own Hono proxy, which is what keeps the backend URL out of the
 * bundle and the request same-origin. On the server it addresses the backend
 * directly and replays the caller's session cookie.
 */
function baseUrl() {
  return typeof window === "undefined" ? `${RAGENTA_API_URL}/v1` : "/api/v1";
}

export const api = ky.create({
  prefixUrl: baseUrl(),
  retry: 0,
  // Uploads and long list queries outlive ky's 10s default.
  timeout: 60_000,
  hooks: {
    beforeRequest: [
      async (request) => {
        if (typeof window !== "undefined") return;
        const cookie = await forwardedCookie();
        if (cookie) request.headers.set("cookie", cookie);
      },
    ],
    afterResponse: [
      async (_request, _options, response) => {
        // A session that expired mid-session leaves the browser on a page it
        // can no longer load. Send it back to the gate rather than to an error
        // card — the same thing the two raw-fetch calls do.
        if (response.status === 401) redirectToLogin();
        return response;
      },
    ],
  },
});

/** The absolute URL of a backend route as seen from the browser. */
export function apiUrl(path: string): string {
  return `/api/v1/${path.replace(/^\//, "")}`;
}
