import { queryOptions } from "@tanstack/react-query";

import { getWebhookDeliveries, getWebhooks } from "../service/webhooks.service";

export const webhookKeys = {
  all: () => ["webhooks"] as const,
  list: (workspaceId: string) => [...webhookKeys.all(), "list", workspaceId] as const,
  deliveries: (workspaceId: string) =>
    [...webhookKeys.all(), "deliveries", workspaceId] as const,
};

export const webhookOptions = {
  list: (workspaceId: string) =>
    queryOptions({
      queryKey: webhookKeys.list(workspaceId),
      queryFn: () => getWebhooks(workspaceId),
    }),
  deliveries: (workspaceId: string) =>
    queryOptions({
      queryKey: webhookKeys.deliveries(workspaceId),
      queryFn: () => getWebhookDeliveries(workspaceId),
    }),
};
