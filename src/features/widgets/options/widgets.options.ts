import { queryOptions } from "@tanstack/react-query";

import { getWidgets } from "../service/widgets.service";

export const widgetKeys = {
  all: () => ["widgets"] as const,
  list: (workspaceId: string) => [...widgetKeys.all(), workspaceId] as const,
};

export const widgetOptions = {
  list: (workspaceId: string) =>
    queryOptions({
      queryKey: widgetKeys.list(workspaceId),
      queryFn: () => getWidgets(workspaceId),
    }),
};
