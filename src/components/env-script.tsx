/**
 * Serializes the client-readable env allowlist into `window.__env` at request
 * time, so one image runs against staging and production without a rebuild.
 * Read it through `lib/config.ts`, never directly.
 *
 * The backend URL is deliberately absent: the browser reaches the backend
 * through this app's own proxy.
 */
export function EnvScript() {
  const env = {
    APP_BASE_URL: process.env.APP_BASE_URL ?? "",
    SITE_BASE_URL: process.env.SITE_BASE_URL ?? "",
  };

  return (
    <script
      dangerouslySetInnerHTML={{ __html: `window.__env=${JSON.stringify(env)}` }}
    />
  );
}
