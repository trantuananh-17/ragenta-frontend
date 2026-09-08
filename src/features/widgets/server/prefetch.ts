import "server-only";

import { getQueryClient } from "@/lib/get-query-client";
import { widgetOptions } from "../options/widgets.options";

export async function prefetchWidgets(workspaceId: string) {
  await getQueryClient().prefetchQuery(widgetOptions.list(workspaceId));
}
