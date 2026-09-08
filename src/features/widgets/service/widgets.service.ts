import { z } from "zod";

import { api } from "@/lib/ky";

/**
 * Embedded chats — the bubble a customer puts on their own website.
 *
 * `publicKey` is returned by the API and shown on screen, unlike every other
 * credential in this app. It is publishable by design: it sits in a `<script>`
 * tag on a public page, so there is nothing to hide and hiding it would only
 * make the screen useless.
 */
export const widgetSchema = z.object({
  id: z.string(),
  agentId: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  publicKey: z.string(),
  allowedOrigins: z.array(z.string()),
  greeting: z.string(),
  accentColor: z.string(),
  title: z.string(),
  dailyCreditCeiling: z.number(),
  visitorHourlyLimit: z.number(),
  createdAt: z.coerce.string(),
});

export type Widget = z.infer<typeof widgetSchema>;

export async function getWidgets(workspaceId: string): Promise<Widget[]> {
  const response = await api.get(`workspaces/${workspaceId}/widgets`);
  const body = await response.json();
  return z.object({ widgets: z.array(widgetSchema) }).parse(body).widgets;
}

export interface SaveWidgetInput {
  id?: string;
  agentId: string;
  name: string;
  enabled: boolean;
  allowedOrigins: string[];
  greeting: string;
  accentColor: string;
  title: string;
  dailyCreditCeiling: number;
  visitorHourlyLimit: number;
}

export async function saveWidget(
  workspaceId: string,
  input: SaveWidgetInput,
): Promise<Widget> {
  const response = await api.put(`workspaces/${workspaceId}/widgets`, { json: input });
  const body = await response.json();
  return z.object({ widget: widgetSchema }).parse(body).widget;
}

export async function deleteWidget(workspaceId: string, widgetId: string): Promise<void> {
  await api.delete(`workspaces/${workspaceId}/widgets/${widgetId}`);
}

/**
 * The two lines somebody pastes into their website.
 *
 * Built from the browser's own origin rather than from a configured value: this
 * app is served from the same host that serves `widget.js`, so a staging
 * snippet can never point at production by being copied from the wrong screen.
 */
export function embedSnippet(publicKey: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `<script src="${origin}/widget.js" data-key="${publicKey}"></script>`;
}
