import "server-only";

import { getQueryClient } from "@/lib/get-query-client";
import { billingOptions } from "../options/billing.options";
import type { GatedPlanFeature } from "../service/billing.service";

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

/**
 * Whether this workspace's plan includes a capability, answered on the server so
 * a page can decide **not** to prefetch what the gate is about to replace.
 *
 * The point of asking here rather than only in `PlanGate` is the fetch: covering
 * rows with an overlay is not a gate, because the rows have already reached the
 * browser. A page that gates a section asks this first and prefetches the rest.
 *
 * It warms the two queries the gate itself suspends on, so resolving it costs
 * the page nothing it did not already owe.
 */
export async function resolvePlanGate(
  workspaceId: string,
  feature: GatedPlanFeature,
): Promise<boolean> {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(billingOptions.summary(workspaceId)),
    queryClient.prefetchQuery(billingOptions.plans()),
  ]);

  // A summary that did not load leaves the plan unknown, and unknown means "do
  // not fetch": the gate asks again on the client and renders whichever way the
  // answer goes, but a request made here cannot be taken back.
  const summary = queryClient.getQueryData(
    billingOptions.summary(workspaceId).queryKey,
  );
  return summary?.limits[feature] ?? false;
}
