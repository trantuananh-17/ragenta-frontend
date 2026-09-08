import { z } from "zod";

import { api } from "@/lib/ky";

/**
 * Accounts somebody connected — a Gmail, a Slack workspace — which an agent then
 * acts as, and the API keys a program authenticates with.
 *
 * Two different credentials on one screen because they answer the same question
 * for whoever is looking: what can act on this workspace's behalf, and as whom.
 */
export const oauthProviderSchema = z.object({
  id: z.string(),
  name: z.string(),
  scopes: z.array(z.string()),
  /** False when the deployment has not registered an app for it. */
  configured: z.boolean(),
});

export const oauthConnectionSchema = z.object({
  id: z.string(),
  provider: z.string(),
  accountLabel: z.string(),
  scopes: z.array(z.string()),
  status: z.string(),
  expiresAt: z.coerce.string().nullable(),
  lastRefreshedAt: z.coerce.string().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.coerce.string(),
  /** False means it works until it expires and then needs reconnecting. */
  renewable: z.boolean(),
});

export type OAuthProvider = z.infer<typeof oauthProviderSchema>;
export type OAuthConnection = z.infer<typeof oauthConnectionSchema>;

export async function getOAuthProviders(workspaceId: string): Promise<OAuthProvider[]> {
  const response = await api.get(`workspaces/${workspaceId}/oauth-providers`);
  const body = await response.json();
  return z.object({ providers: z.array(oauthProviderSchema) }).parse(body).providers;
}

export async function getOAuthConnections(workspaceId: string): Promise<OAuthConnection[]> {
  const response = await api.get(`workspaces/${workspaceId}/oauth-connections`);
  const body = await response.json();
  return z.object({ connections: z.array(oauthConnectionSchema) }).parse(body).connections;
}

/**
 * Begins an authorisation and returns where to send the browser.
 *
 * A URL rather than a redirect, because this is called by a `fetch`: a 302 on an
 * XHR is followed by the browser into a page it cannot render.
 */
export async function startOAuth(
  workspaceId: string,
  provider: string,
  returnTo: string,
): Promise<string> {
  const response = await api.post(
    `workspaces/${workspaceId}/oauth-connections/${provider}/start`,
    { json: { returnTo } },
  );
  const body = await response.json();
  return z.object({ authorizeUrl: z.string() }).parse(body).authorizeUrl;
}

export async function disconnectOAuth(
  workspaceId: string,
  connectionId: string,
): Promise<void> {
  await api.delete(`workspaces/${workspaceId}/oauth-connections/${connectionId}`);
}

export const apiKeySchema = z.object({
  id: z.string(),
  name: z.string(),
  /** `rag_ab12…f9`. The key itself is shown once, at creation, and never again. */
  hint: z.string(),
  permissions: z.array(z.string()),
  expiresAt: z.coerce.string().nullable(),
  revokedAt: z.coerce.string().nullable(),
  lastUsedAt: z.coerce.string().nullable(),
  createdAt: z.coerce.string(),
  status: z.string(),
});

export type ApiKey = z.infer<typeof apiKeySchema>;

export async function getApiKeys(workspaceId: string): Promise<ApiKey[]> {
  const response = await api.get(`workspaces/${workspaceId}/api-keys`);
  const body = await response.json();
  return z.object({ keys: z.array(apiKeySchema) }).parse(body).keys;
}

/** The only response that carries the key. It is stored hashed. */
export async function createApiKey(
  workspaceId: string,
  input: { name: string; permissions: string[]; expiresAt?: string },
): Promise<{ hint: string; secret: string }> {
  const response = await api.post(`workspaces/${workspaceId}/api-keys`, { json: input });
  const body = await response.json();
  const parsed = z
    .object({ key: z.object({ hint: z.string() }), secret: z.string() })
    .parse(body);
  return { hint: parsed.key.hint, secret: parsed.secret };
}

export async function revokeApiKey(workspaceId: string, keyId: string): Promise<void> {
  await api.delete(`workspaces/${workspaceId}/api-keys/${keyId}`);
}

/** What the caller may do here, so the key form can only offer what it can grant. */
export async function getMyPermissions(workspaceId: string): Promise<string[]> {
  const response = await api.get(`workspaces/${workspaceId}/permissions`);
  const body = await response.json();
  return z.object({ permissions: z.array(z.string()) }).parse(body).permissions;
}
