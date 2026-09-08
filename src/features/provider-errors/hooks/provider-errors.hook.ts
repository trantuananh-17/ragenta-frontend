"use client";

import { useQuery } from "@tanstack/react-query";

import { providerErrorOptions } from "../options/provider-errors.options";

/**
 * Not a suspense query: this sits behind a tab nobody opens on a normal day, and
 * fetching it up front would make every visit to Usage wait on a table that is
 * usually empty.
 */
export function useProviderErrors(workspaceId: string) {
  return useQuery(providerErrorOptions.list(workspaceId));
}
