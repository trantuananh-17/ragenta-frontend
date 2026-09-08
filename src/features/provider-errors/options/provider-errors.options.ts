import { queryOptions } from "@tanstack/react-query";

import { getProviderErrors } from "../service/provider-errors.service";

export const providerErrorKeys = {
  all: () => ["provider-errors"] as const,
  list: (workspaceId: string) =>
    [...providerErrorKeys.all(), "list", workspaceId] as const,
};

export const providerErrorOptions = {
  list: (workspaceId: string) =>
    queryOptions({
      queryKey: providerErrorKeys.list(workspaceId),
      queryFn: () => getProviderErrors(workspaceId),
    }),
};
