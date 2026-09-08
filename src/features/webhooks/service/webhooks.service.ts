import { z } from "zod";

import { api } from "@/lib/ky";

/**
 * Where this workspace asks to be told when something happens here.
 *
 * The outbound half of the pair: an agent trigger is somebody else calling us,
 * an endpoint is us calling them. The signing secret is never in this shape — it
 * is returned once, by the call that created or rotated it, and the API answers
 * with a hint afterwards.
 */
export const webhookEndpointSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string(),
  enabled: z.boolean(),
  events: z.array(z.string()),
  secretHint: z.string(),
  /** Consecutive failures. Twenty of them switch the endpoint off. */
  failureCount: z.number(),
  disabledAt: z.coerce.string().nullable(),
  lastDeliveryAt: z.coerce.string().nullable(),
  lastError: z.string().nullable(),
  createdAt: z.coerce.string(),
});

export type WebhookEndpoint = z.infer<typeof webhookEndpointSchema>;

/** One event a workspace may subscribe to, as the backend's catalogue describes it. */
export const webhookEventSchema = z.object({
  key: z.string(),
  summary: z.string(),
  /** What the payload's `data` carries, so somebody can write the receiver. */
  fields: z.array(z.string()),
});

export type WebhookEvent = z.infer<typeof webhookEventSchema>;

const listResponse = z.object({
  endpoints: z.array(webhookEndpointSchema),
  // Sent with the list rather than from its own endpoint: the screen cannot
  // render a subscription without it, and it is four compiled-in rows.
  events: z.array(webhookEventSchema),
});

export type WebhookList = z.infer<typeof listResponse>;

export async function getWebhooks(workspaceId: string): Promise<WebhookList> {
  const response = await api.get(`workspaces/${workspaceId}/webhooks`);
  return listResponse.parse(await response.json());
}

export interface SaveWebhookInput {
  name: string;
  url: string;
  enabled: boolean;
  events: string[];
}

const createdResponse = z.object({
  endpoint: webhookEndpointSchema.optional(),
  /** The signing secret, shown once and never again. */
  secret: z.string(),
});

export type CreatedWebhook = z.infer<typeof createdResponse>;

export async function createWebhook(
  workspaceId: string,
  input: SaveWebhookInput,
): Promise<CreatedWebhook> {
  const response = await api.post(`workspaces/${workspaceId}/webhooks`, { json: input });
  return createdResponse.parse(await response.json());
}

export async function updateWebhook(
  workspaceId: string,
  endpointId: string,
  input: SaveWebhookInput,
): Promise<void> {
  await api.put(`workspaces/${workspaceId}/webhooks/${endpointId}`, { json: input });
}

export async function rotateWebhookSecret(
  workspaceId: string,
  endpointId: string,
): Promise<string> {
  const response = await api.post(
    `workspaces/${workspaceId}/webhooks/${endpointId}/rotate-secret`,
  );
  const body = z.object({ secret: z.string() }).parse(await response.json());
  return body.secret;
}

export async function deleteWebhook(
  workspaceId: string,
  endpointId: string,
): Promise<void> {
  await api.delete(`workspaces/${workspaceId}/webhooks/${endpointId}`);
}

/**
 * One attempt to deliver one event.
 *
 * The failed ones are the point: "we sent it" and "your server 500ed twice and
 * then took it" are different stories, and without the row the second is
 * indistinguishable from the first.
 */
export const webhookDeliverySchema = z.object({
  id: z.string(),
  endpointId: z.string(),
  event: z.string(),
  status: z.enum(["pending", "succeeded", "failed"]),
  attempt: z.number(),
  responseStatus: z.number().nullable(),
  responseBody: z.string().nullable(),
  error: z.string().nullable(),
  durationMs: z.number().nullable(),
  createdAt: z.coerce.string(),
  deliveredAt: z.coerce.string().nullable(),
});

export type WebhookDelivery = z.infer<typeof webhookDeliverySchema>;

export async function getWebhookDeliveries(
  workspaceId: string,
): Promise<WebhookDelivery[]> {
  const response = await api.get(`workspaces/${workspaceId}/webhook-deliveries`);
  const body = z
    .object({ deliveries: z.array(webhookDeliverySchema) })
    .parse(await response.json());
  return body.deliveries;
}
