"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api-error";
import { connectionKeys, connectionOptions } from "../options/connections.options";
import {
  createApiKey,
  disconnectOAuth,
  revokeApiKey,
  startOAuth,
} from "../service/connections.service";

export function useOAuthProvidersSuspense(workspaceId: string) {
  return useSuspenseQuery(connectionOptions.providers(workspaceId));
}

export function useOAuthConnectionsSuspense(workspaceId: string) {
  return useSuspenseQuery(connectionOptions.oauth(workspaceId));
}

export function useApiKeysSuspense(workspaceId: string) {
  return useSuspenseQuery(connectionOptions.apiKeys(workspaceId));
}

export function useMyPermissionsSuspense(workspaceId: string) {
  return useSuspenseQuery(connectionOptions.permissions(workspaceId));
}

/**
 * Starting an authorisation is a **navigation**, not a mutation whose result is
 * rendered: the browser leaves for the provider and comes back to the callback,
 * which redirects here with `?connected=` or `?error=`.
 */
export function useStartOAuth(workspaceId: string) {
  return useMutation({
    mutationFn: (provider: string) =>
      startOAuth(workspaceId, provider, "/settings/connections"),
    onSuccess: (authorizeUrl) => {
      window.location.href = authorizeUrl;
    },
    onError: async (error) => {
      toast.error("Could not start", { description: await errorMessage(error) });
    },
  });
}

export function useDisconnectOAuth(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (connectionId: string) => disconnectOAuth(workspaceId, connectionId),
    onSuccess: () => {
      toast.success("Disconnected.");
      queryClient.invalidateQueries({ queryKey: connectionKeys.oauth(workspaceId) });
    },
    onError: async (error) => {
      toast.error("Could not disconnect", { description: await errorMessage(error) });
    },
  });
}

export function useCreateApiKey(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: Parameters<typeof createApiKey>[1]) => createApiKey(workspaceId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: connectionKeys.apiKeys(workspaceId) });
    },
    onError: async (error) => {
      // The refusal names the permission the creator does not hold, which is the
      // whole point of showing it rather than something generic.
      toast.error("Could not create the key", { description: await errorMessage(error) });
    },
  });
}

export function useRevokeApiKey(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (keyId: string) => revokeApiKey(workspaceId, keyId),
    onSuccess: () => {
      toast.success("Revoked.");
      queryClient.invalidateQueries({ queryKey: connectionKeys.apiKeys(workspaceId) });
    },
    onError: async (error) => {
      toast.error("Could not revoke", { description: await errorMessage(error) });
    },
  });
}
