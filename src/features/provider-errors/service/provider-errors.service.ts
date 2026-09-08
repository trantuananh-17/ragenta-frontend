import { z } from "zod";

import { api } from "@/lib/ky";

/**
 * `GET /v1/workspaces/:id/provider-errors` — this workspace's own failed calls
 * to a model provider.
 *
 * Its reason for existing: a customer whose agent stopped working should be able
 * to read the provider's refusal themselves rather than asking somebody to look
 * at a log for them. Only failures are recorded, so an empty list means nothing
 * failed, not that nothing was checked.
 */
export const providerErrorSchema = z.object({
  id: z.string(),
  organizationId: z.string().nullable(),
  provider: z.string(),
  model: z.string().nullable(),
  operation: z.string(),
  /** Null for a timeout or a dropped connection, where there was no status. */
  status: z.number().nullable(),
  message: z.string(),
  durationMs: z.number().nullable(),
  createdAt: z.coerce.string(),
});

export type ProviderError = z.infer<typeof providerErrorSchema>;

export async function getProviderErrors(
  workspaceId: string,
): Promise<ProviderError[]> {
  const response = await api.get(`workspaces/${workspaceId}/provider-errors`);
  const body = z
    .object({ errors: z.array(providerErrorSchema) })
    .parse(await response.json());
  return body.errors;
}

/**
 * What a failure usually means, in terms of what to do about it.
 *
 * Written for whoever owns the workspace, not for whoever owns the platform: a
 * 401 here means *their* key, and a 429 is something they raise with the
 * provider rather than something we can fix for them.
 */
export function explainStatus(status: number | null): string {
  if (status === null) return "No response — the provider timed out or the connection dropped.";
  if (status === 401 || status === 403)
    return "The provider refused the key. Check it is still valid in Settings → Models.";
  if (status === 404) return "That model does not exist for this key.";
  if (status === 429) return "Rate limited or out of quota at the provider.";
  if (status === 402) return "A billing problem at the provider.";
  if (status >= 500) return "The provider's own failure. Usually transient — try again.";
  if (status === 400 || status === 422)
    return "The request was rejected, often for too long an input or an unsupported model.";
  return "";
}
