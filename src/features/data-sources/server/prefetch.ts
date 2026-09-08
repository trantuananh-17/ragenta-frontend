import "server-only";

import { getQueryClient } from "@/lib/get-query-client";
import { dataSourceOptions } from "../options/data-sources.options";

export async function prefetchDataSources(workspaceId: string) {
  await getQueryClient().prefetchQuery(dataSourceOptions.list(workspaceId));
}
