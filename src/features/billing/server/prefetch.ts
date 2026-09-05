import "server-only";

import { getQueryClient } from "@/lib/get-query-client";
import { billingOptions } from "../options/billing.options";

/**
 * The transactions list and auto-reload are owner/admin only. They are
 * prefetched anyway rather than branched on here: a `viewer` gets a 403 the
 * query boundary renders as its error state, and the page already hides the
 * sections. Branching in two places is how the two go out of step.
 */
export async function prefetchBilling(workspaceId: string) {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(billingOptions.summary(workspaceId)),
    queryClient.prefetchQuery(billingOptions.plans()),
    queryClient.prefetchQuery(billingOptions.promos(workspaceId)),
  ]);
}
