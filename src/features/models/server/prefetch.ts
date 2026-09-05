import "server-only";

import { getQueryClient } from "@/lib/get-query-client";
import { modelsOptions } from "../options/models.options";

export async function prefetchModels(workspaceId: string) {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(modelsOptions.catalogue(workspaceId)),
    queryClient.prefetchQuery(modelsOptions.settings(workspaceId)),
  ]);
}
