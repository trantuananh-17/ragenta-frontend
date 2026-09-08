"use client";

import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api-error";
import { dataSourceKeys, dataSourceOptions } from "../options/data-sources.options";
import {
  deleteDataSource,
  deleteQuery,
  dryRun,
  generateQuery,
  refreshSchema,
  saveDataSource,
  saveQuery,
} from "../service/data-sources.service";

export function useDataSourcesSuspense(workspaceId: string) {
  return useSuspenseQuery(dataSourceOptions.list(workspaceId));
}

function useSourceMutation<TVariables>(
  workspaceId: string,
  action: (variables: TVariables) => Promise<unknown>,
  success: string,
  failure: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: action,
    onSuccess: () => {
      toast.success(success);
      queryClient.invalidateQueries({ queryKey: dataSourceKeys.list(workspaceId) });
    },
    onError: async (error) => {
      // The database's own refusal — a wrong password, a missing table — is what
      // makes this fixable, so it is shown rather than replaced.
      toast.error(failure, { description: await errorMessage(error) });
    },
  });
}

export function useSaveDataSource(workspaceId: string) {
  return useSourceMutation(
    workspaceId,
    (input: Parameters<typeof saveDataSource>[1]) => saveDataSource(workspaceId, input),
    "Connection saved.",
    "Could not save the connection",
  );
}

export function useRefreshSchema(workspaceId: string) {
  return useSourceMutation(
    workspaceId,
    (sourceId: string) => refreshSchema(workspaceId, sourceId),
    "Schema read.",
    "Could not read the schema",
  );
}

export function useDeleteDataSource(workspaceId: string) {
  return useSourceMutation(
    workspaceId,
    (sourceId: string) => deleteDataSource(workspaceId, sourceId),
    "Connection removed.",
    "Could not remove the connection",
  );
}

export function useSaveQuery(workspaceId: string) {
  return useSourceMutation(
    workspaceId,
    (input: Parameters<typeof saveQuery>[1]) => saveQuery(workspaceId, input),
    "Query saved.",
    "Could not save the query",
  );
}

export function useDeleteQuery(workspaceId: string) {
  return useSourceMutation(
    workspaceId,
    (queryId: string) => deleteQuery(workspaceId, queryId),
    "Query removed.",
    "Could not remove the query",
  );
}

/**
 * Proposing and running are **not** cache-invalidating: neither saves anything.
 * That is the point of the flow — a proposal is a suggestion on screen until
 * somebody has run it and approved it.
 */
export function useGenerateQuery(workspaceId: string) {
  return useMutation({
    mutationFn: (input: Parameters<typeof generateQuery>[1]) =>
      generateQuery(workspaceId, input),
    onError: async (error) => {
      toast.error("Could not write a query", { description: await errorMessage(error) });
    },
  });
}

export function useDryRun(workspaceId: string) {
  return useMutation({
    mutationFn: (input: Parameters<typeof dryRun>[1]) => dryRun(workspaceId, input),
    onError: async (error) => {
      toast.error("The query did not run", { description: await errorMessage(error) });
    },
  });
}
