import "server-only";

import { getQueryClient } from "@/lib/get-query-client";
import { webhookOptions } from "../options/webhooks.options";

export async function prefetchWebhooks(workspaceId: string) {
  await getQueryClient().prefetchQuery(webhookOptions.list(workspaceId));
}
