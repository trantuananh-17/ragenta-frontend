import "server-only";

import { getQueryClient } from "@/lib/get-query-client";
import { connectionOptions } from "../options/connections.options";

/**
 * `apiKeysAllowed` decides whether the key list is asked for at all.
 *
 * On a plan without API keys the screen renders a replica instead of the list,
 * and fetching it anyway would have put this workspace's real keys — their
 * names, hints and last use — into the page before anything covered them. The
 * permission list goes with it: only the create form reads it.
 */
export async function prefetchConnections(
  workspaceId: string,
  apiKeysAllowed: boolean,
) {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(connectionOptions.providers(workspaceId)),
    queryClient.prefetchQuery(connectionOptions.oauth(workspaceId)),
    ...(apiKeysAllowed
      ? [
          queryClient.prefetchQuery(connectionOptions.apiKeys(workspaceId)),
          queryClient.prefetchQuery(connectionOptions.permissions(workspaceId)),
        ]
      : []),
  ]);
}
