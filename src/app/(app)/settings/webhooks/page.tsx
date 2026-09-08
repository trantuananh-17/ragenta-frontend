import { Suspense } from "react";
import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import {
  WebhooksError,
  WebhooksLoading,
  WebhooksScreen,
} from "@/features/webhooks/components";
import { prefetchWebhooks } from "@/features/webhooks/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Webhooks" };

export default async function WebhooksPage() {
  const workspace = await requireWorkspace();
  await prefetchWebhooks(workspace.id);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<WebhooksError />}>
        <Suspense fallback={<WebhooksLoading />}>
          <WebhooksScreen />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
