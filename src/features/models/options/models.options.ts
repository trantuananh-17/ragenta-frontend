import { queryOptions } from "@tanstack/react-query";

import { getModelCatalogue, getModelSettings } from "../service/models.service";

export const modelsKeys = {
  all: () => ["models"] as const,
  catalogue: (workspaceId: string) =>
    [...modelsKeys.all(), "catalogue", workspaceId] as const,
  settings: (workspaceId: string) =>
    [...modelsKeys.all(), "settings", workspaceId] as const,
};

export const modelsOptions = {
  catalogue: (workspaceId: string) =>
    queryOptions({
      queryKey: modelsKeys.catalogue(workspaceId),
      queryFn: () => getModelCatalogue(workspaceId),
      // The catalogue changes when a platform admin stores a provider key, which
      // is rare. Five minutes keeps every picker on one fetch.
      staleTime: 5 * 60 * 1000,
    }),
  settings: (workspaceId: string) =>
    queryOptions({
      queryKey: modelsKeys.settings(workspaceId),
      queryFn: () => getModelSettings(workspaceId),
    }),
};
