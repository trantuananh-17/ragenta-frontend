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
