import { queryOptions } from "@tanstack/react-query";

import {
  getApiKeys,
  getHttpConnections,
  getMyPermissions,
  getOAuthConnections,
  getOAuthProviders,
} from "../service/connections.service";

export const connectionKeys = {
  all: () => ["connections"] as const,
  providers: (workspaceId: string) => [...connectionKeys.all(), "providers", workspaceId] as const,
  oauth: (workspaceId: string) => [...connectionKeys.all(), "oauth", workspaceId] as const,
  apiKeys: (workspaceId: string) => [...connectionKeys.all(), "api-keys", workspaceId] as const,
  http: (workspaceId: string) => [...connectionKeys.all(), "http", workspaceId] as const,
  permissions: (workspaceId: string) =>
    [...connectionKeys.all(), "permissions", workspaceId] as const,
};

export const connectionOptions = {
  providers: (workspaceId: string) =>
    queryOptions({
      queryKey: connectionKeys.providers(workspaceId),
      queryFn: () => getOAuthProviders(workspaceId),
    }),
  oauth: (workspaceId: string) =>
    queryOptions({
      queryKey: connectionKeys.oauth(workspaceId),
      queryFn: () => getOAuthConnections(workspaceId),
    }),
  apiKeys: (workspaceId: string) =>
    queryOptions({
      queryKey: connectionKeys.apiKeys(workspaceId),
      queryFn: () => getApiKeys(workspaceId),
    }),
  http: (workspaceId: string) =>
    queryOptions({
      queryKey: connectionKeys.http(workspaceId),
      queryFn: () => getHttpConnections(workspaceId),
    }),
  permissions: (workspaceId: string) =>
    queryOptions({
      queryKey: connectionKeys.permissions(workspaceId),
      queryFn: () => getMyPermissions(workspaceId),
    }),
};
