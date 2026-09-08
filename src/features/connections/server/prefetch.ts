import "server-only";

import { getQueryClient } from "@/lib/get-query-client";
import { connectionOptions } from "../options/connections.options";

export async function prefetchConnections(workspaceId: string) {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(connectionOptions.providers(workspaceId)),
    queryClient.prefetchQuery(connectionOptions.oauth(workspaceId)),
    queryClient.prefetchQuery(connectionOptions.apiKeys(workspaceId)),
    queryClient.prefetchQuery(connectionOptions.permissions(workspaceId)),
  ]);
}
