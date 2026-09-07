"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api-error";
import { modelsKeys, modelsOptions } from "../options/models.options";
import {
  updateModelSettings,
  type ModelSelection,
} from "../service/models.service";

export function useModelCatalogueSuspense(workspaceId: string) {
  return useSuspenseQuery(modelsOptions.catalogue(workspaceId));
}

/**
 * Non-suspending, for pickers embedded in a screen that must render before the
 * catalogue arrives — the chat composer above all, which has to accept typing
 * immediately.
 */
export function useModelCatalogue(workspaceId: string) {
  return useQuery(modelsOptions.catalogue(workspaceId));
}

export function useModelSettingsSuspense(workspaceId: string) {
  return useSuspenseQuery(modelsOptions.settings(workspaceId));
}

export function useModelSettings(workspaceId: string) {
  return useQuery(modelsOptions.settings(workspaceId));
}

/**
 * Whether the model a turn will actually run can read images.
 *
 * `null` means not knowable yet — the catalogue or the workspace default has
 * not arrived, or the resolved model is not in the catalogue at all. Callers
 * stay permissive there rather than guessing: the backend refuses a vision turn
 * on a text-only model before the stream opens, so a wrongly greyed-out control
 * is the worse of the two failures.
 */
export function useVisionSupport(
  workspaceId: string,
  selection: ModelSelection | null,
): boolean | null {
  const catalogue = useModelCatalogue(workspaceId);
  const settings = useModelSettings(workspaceId);

  // No per-turn override means the workspace's own chat model answers the turn.
  const resolved = selection ?? settings.data?.chat ?? null;
  if (!resolved || !catalogue.data) return null;

  const model = catalogue.data.models.find(
    (candidate) =>
      candidate.provider === resolved.provider &&
      candidate.model === resolved.model,
  );
  return model ? model.vision : null;
}

export function useUpdateModelSettings(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { chat?: ModelSelection; embedding?: ModelSelection }) =>
      updateModelSettings(workspaceId, input),
    onSuccess: () => {
      toast.success("Model settings saved.");
      queryClient.invalidateQueries({ queryKey: modelsKeys.all() });
    },
    onError: async (error) => {
      toast.error("Selection refused", {
        description: await errorMessage(error),
      });
    },
  });
}
