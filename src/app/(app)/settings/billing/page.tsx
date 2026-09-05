import { Suspense } from "react";
import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import {
  BillingError,
  BillingLoading,
  BillingScreen,
} from "@/features/billing/components";
import { prefetchBilling } from "@/features/billing/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Billing" };

export default async function BillingPage() {
  const workspace = await requireWorkspace();
  await prefetchBilling(workspace.id);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<BillingError />}>
        <Suspense fallback={<BillingLoading />}>
          <BillingScreen />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
