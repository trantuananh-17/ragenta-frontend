/**
 * Runtime configuration, not build-time. `EnvScript` serializes the allowlist
 * below into `window.__env` on every render, so one Docker image runs against
 * staging and production without being rebuilt.
 *
 * Only values a browser may see belong here. The backend URL never does — the
 * browser reaches the backend through this app's own /api/* proxy.
 */
declare global {
  interface Window {
    __env?: {
      APP_BASE_URL?: string;
      SITE_BASE_URL?: string;
    };
  }
}

type PublicKey = keyof NonNullable<Window["__env"]>;

function runtimeEnv(key: PublicKey, fallback: string): string {
  if (typeof window !== "undefined") return window.__env?.[key] || fallback;
  return process.env[key] || fallback;
}

/** This app's own origin. OAuth callbacks and reset links come back to it. */
export const appBaseUrl = () =>
  runtimeEnv("APP_BASE_URL", "http://localhost:3001");

/** The marketing site — where the legal pages and pricing actually live. */
export const siteBaseUrl = () =>
  runtimeEnv("SITE_BASE_URL", "http://localhost:3000");
