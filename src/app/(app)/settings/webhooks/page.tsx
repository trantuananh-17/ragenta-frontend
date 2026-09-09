import { Suspense } from "react";
import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import { PlanGate } from "@/components/plan-gate";
import { resolvePlanGate } from "@/features/billing/server/prefetch";
import {
  WebhooksError,
  WebhooksLoading,
  WebhooksPreview,
  WebhooksScreen,
} from "@/features/webhooks/components";
import { prefetchWebhooks } from "@/features/webhooks/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Webhooks" };

/**
 * The whole screen is gated, so both halves of the gate live here: the endpoint
 * list is not prefetched on a plan without automation, and `PlanGate` renders
 * the replica instead of the screen that would otherwise fetch it — the list
 * names the URLs this workspace sends its own data to.
 */
export default async function WebhooksPage() {
  const workspace = await requireWorkspace();
  const allowed = await resolvePlanGate(workspace.id, "automationEnabled");
  if (allowed) await prefetchWebhooks(workspace.id);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<WebhooksError />}>
        <Suspense fallback={<WebhooksLoading />}>
          <PlanGate feature="automationEnabled" preview={<WebhooksPreview />}>
            <WebhooksScreen />
          </PlanGate>
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
