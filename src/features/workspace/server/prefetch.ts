import "server-only";

import { getQueryClient } from "@/lib/get-query-client";
import { workspaceOptions } from "../options/workspace.options";

export async function prefetchWorkspaceOverview(workspaceId: string) {
  await getQueryClient().prefetchQuery(workspaceOptions.overview(workspaceId));
}

export async function prefetchMembers(workspaceId: string) {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(workspaceOptions.members(workspaceId)),
    queryClient.prefetchQuery(workspaceOptions.invitations(workspaceId)),
  ]);
}
