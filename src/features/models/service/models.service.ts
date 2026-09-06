import { z } from "zod";

import { api } from "@/lib/ky";

/**
 * The model catalogue as this workspace sees it.
 *
 * Two independent gates decide whether a model can be picked, and both are
 * reported so a picker can say *why* something is unavailable rather than just
 * greying it out: `configured` is whether the deployment holds a provider key,
 * `entitled` is whether the plan includes the model's tier.
 */
export const catalogueModelSchema = z.object({
  provider: z.string(),
  model: z.string(),
  capability: z.enum(["chat", "embedding", "rerank"]),
  tier: z.string(),
  /**
   * Nullish, not nullable: only chat and rerank models have one, and a field
   * that is merely decorative here must never be the reason the whole catalogue
   * fails to parse and five screens lose their model pickers.
   */
  contextWindow: z.number().nullish().default(null),
  configured: z.boolean(),
  entitled: z.boolean(),
  selectable: z.boolean(),
});

export const modelCatalogueSchema = z.object({
  plan: z.string(),
  configuredProviders: z.array(z.string()),
  models: z.array(catalogueModelSchema),
});

export const modelSelectionSchema = z.object({
  provider: z.string(),
  model: z.string(),
});

export const modelSettingsSchema = z.object({
  chat: modelSelectionSchema,
  embedding: modelSelectionSchema,
  /** True while the workspace has never saved a selection of its own. */
  isDefault: z.boolean(),
});

export type CatalogueModel = z.infer<typeof catalogueModelSchema>;
export type ModelCatalogue = z.infer<typeof modelCatalogueSchema>;
export type ModelSelection = z.infer<typeof modelSelectionSchema>;
export type ModelSettings = z.infer<typeof modelSettingsSchema>;

export async function getModelCatalogue(
  workspaceId: string,
): Promise<ModelCatalogue> {
  const response = await api.get(`workspaces/${workspaceId}/models`);
  return modelCatalogueSchema.parse(await response.json());
}

export async function getModelSettings(
  workspaceId: string,
): Promise<ModelSettings> {
  const response = await api.get(`workspaces/${workspaceId}/settings/models`);
  return modelSettingsSchema.parse(await response.json());
}

export async function updateModelSettings(
  workspaceId: string,
  input: { chat?: ModelSelection; embedding?: ModelSelection },
): Promise<void> {
  await api.put(`workspaces/${workspaceId}/settings/models`, { json: input });
}

/** `provider/model`, the form both the picker value and the URL use. */
export function modelKey(selection: ModelSelection): string {
  return `${selection.provider}/${selection.model}`;
}

export function parseModelKey(key: string): ModelSelection | null {
  const separator = key.indexOf("/");
  if (separator < 1) return null;
  return {
    provider: key.slice(0, separator),
    model: key.slice(separator + 1),
  };
}
