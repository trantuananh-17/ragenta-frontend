import { queryOptions } from "@tanstack/react-query";

import { getDataSources } from "../service/data-sources.service";

export const dataSourceKeys = {
  all: () => ["data-sources"] as const,
  list: (workspaceId: string) => [...dataSourceKeys.all(), workspaceId] as const,
};

export const dataSourceOptions = {
  list: (workspaceId: string) =>
    queryOptions({
      queryKey: dataSourceKeys.list(workspaceId),
      queryFn: () => getDataSources(workspaceId),
    }),
};
