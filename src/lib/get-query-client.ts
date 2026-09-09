import { cache } from "react";

import {
  QueryClient,
  defaultShouldDehydrateQuery,
  environmentManager,
} from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
      dehydrate: {
        // Dehydrate pending queries too, so a server prefetch that has not
        // settled still streams to the client instead of refetching there.
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) || query.state.status === "pending",
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * One client per server request, not one per call.
 *
 * `getQueryClient` is reached twice while a page renders on the server — once
 * inside its prefetch helper, once by `dehydrate` — and an unmemoised factory
 * answered with a different client each time. The prefetch filled one and the
 * page dehydrated the other, so every screen shipped an empty hydration state,
 * the browser refetched what the server had just fetched, and each page view
 * cost the API two requests for the same rows.
 *
 * `cache` scopes the memo to a single request, which is the only lifetime a
 * query client may have on a server: shared across one render, never across two
 * people. A module-level singleton would leak one user's data into another's
 * page, which is why the factory could not simply be hoisted.
 */
const getServerQueryClient = cache(makeQueryClient);

export function getQueryClient() {
  if (environmentManager.isServer()) return getServerQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
