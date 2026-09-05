"use client";

import { createAuthClient } from "better-auth/react";
import { organizationClient } from "better-auth/client/plugins";

/**
 * Better Auth's own surface: sign-up, sign-in, sign-out, password reset, and
 * the organization plugin operations `ragenta-backend` mounts — a workspace is
 * a Better Auth organization.
 *
 * Ragenta's product API is plain REST and goes through `lib/ky.ts` instead.
 *
 * Dual-mode: in the browser it calls `/api/auth`, same-origin, so the session
 * cookie is attached automatically and the proxy forwards it upstream.
 */
export const authClient = createAuthClient({
  baseURL:
    typeof window === "undefined"
      ? process.env.RAGENTA_API_URL || "http://localhost:8080"
      : "",
  basePath: typeof window === "undefined" ? "/v1/auth" : "/api/auth",
  plugins: [organizationClient()],
});
