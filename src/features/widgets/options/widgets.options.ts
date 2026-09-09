import { queryOptions } from "@tanstack/react-query";

import { getWidgetUsage, getWidgets } from "../service/widgets.service";

export const widgetKeys = {
  all: () => ["widgets"] as const,
  list: (workspaceId: string) => [...widgetKeys.all(), workspaceId] as const,
  usage: (workspaceId: string, widgetId: string, days: number) =>
    [...widgetKeys.all(), workspaceId, widgetId, "usage", days] as const,
};

export const widgetOptions = {
  list: (workspaceId: string) =>
    queryOptions({
      queryKey: widgetKeys.list(workspaceId),
      queryFn: () => getWidgets(workspaceId),
    }),
  usage: (workspaceId: string, widgetId: string, days: number) =>
    queryOptions({
      queryKey: widgetKeys.usage(workspaceId, widgetId, days),
      queryFn: () => getWidgetUsage(workspaceId, widgetId, days),
    }),
};
