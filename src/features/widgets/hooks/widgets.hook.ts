"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api-error";
import { widgetKeys, widgetOptions } from "../options/widgets.options";
import { deleteWidget, saveWidget, type SaveWidgetInput } from "../service/widgets.service";

export function useWidgetsSuspense(workspaceId: string) {
  return useSuspenseQuery(widgetOptions.list(workspaceId));
}

/** Only fetched while the activity panel is open — one widget out of a list. */
export function useWidgetUsage(
  workspaceId: string,
  widgetId: string | null,
  days: number,
) {
  return useQuery({
    ...widgetOptions.usage(workspaceId, widgetId ?? "", days),
    enabled: widgetId !== null,
  });
}

export function useSaveWidget(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SaveWidgetInput) => saveWidget(workspaceId, input),
    onSuccess: () => {
      toast.success("Saved.");
      queryClient.invalidateQueries({ queryKey: widgetKeys.list(workspaceId) });
    },
    onError: async (error) => {
      // The plan refusal comes back with the sentence that names the upgrade, so
      // it is shown rather than replaced with something generic.
      toast.error("Could not save", { description: await errorMessage(error) });
    },
  });
}

export function useDeleteWidget(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (widgetId: string) => deleteWidget(workspaceId, widgetId),
    onSuccess: () => {
      toast.success("Removed.");
      queryClient.invalidateQueries({ queryKey: widgetKeys.list(workspaceId) });
    },
    onError: async (error) => {
      toast.error("Could not remove", { description: await errorMessage(error) });
    },
  });
}
