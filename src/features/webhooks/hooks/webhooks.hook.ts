"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api-error";
import { webhookKeys, webhookOptions } from "../options/webhooks.options";
import {
  createWebhook,
  deleteWebhook,
  rotateWebhookSecret,
  updateWebhook,
  type SaveWebhookInput,
} from "../service/webhooks.service";

export function useWebhooksSuspense(workspaceId: string) {
  return useSuspenseQuery(webhookOptions.list(workspaceId));
}

/**
 * Not a suspense query: the delivery log is opened when somebody is arguing
 * about whether an event was sent, not on every visit to the settings page.
 */
export function useWebhookDeliveries(workspaceId: string, enabled: boolean) {
  return useQuery({ ...webhookOptions.deliveries(workspaceId), enabled });
}

function useWebhookMutation<TVariables, TData>(
  workspaceId: string,
  action: (variables: TVariables) => Promise<TData>,
  failure: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: action,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: webhookKeys.list(workspaceId) });
    },
    onError: async (error) => {
      toast.error(failure, { description: await errorMessage(error) });
    },
  });
}

/**
 * Creates an endpoint. The secret is in the result and nowhere else — it is
 * encrypted at rest and never read back out, so the caller shows it once.
 */
export function useCreateWebhook(workspaceId: string) {
  return useWebhookMutation(
    workspaceId,
    (input: SaveWebhookInput) => createWebhook(workspaceId, input),
    "The endpoint could not be added",
  );
}

export function useUpdateWebhook(workspaceId: string) {
  return useWebhookMutation(
    workspaceId,
    (variables: { endpointId: string; input: SaveWebhookInput }) =>
      updateWebhook(workspaceId, variables.endpointId, variables.input),
    "The endpoint could not be changed",
  );
}

/** Issues a new secret and returns it once. The old one stops working here. */
export function useRotateWebhookSecret(workspaceId: string) {
  return useWebhookMutation(
    workspaceId,
    (endpointId: string) => rotateWebhookSecret(workspaceId, endpointId),
    "The secret could not be rotated",
  );
}

export function useDeleteWebhook(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (endpointId: string) => deleteWebhook(workspaceId, endpointId),
    onSuccess: () => {
      toast.success("Endpoint removed.");
      queryClient.invalidateQueries({ queryKey: webhookKeys.list(workspaceId) });
    },
    onError: async (error) => {
      toast.error("The endpoint could not be removed", {
        description: await errorMessage(error),
      });
    },
  });
}
