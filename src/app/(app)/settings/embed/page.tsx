import { Suspense } from "react";
import type { Metadata } from "next";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import { WidgetsError, WidgetsLoading, WidgetsScreen } from "@/features/widgets/components";
import { prefetchAgents } from "@/features/agents/server/prefetch";
import { prefetchWidgets } from "@/features/widgets/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export const metadata: Metadata = { title: "Embedded chat" };

export default async function EmbedPage() {
  const workspace = await requireWorkspace();
  // The agent list too: the form has to name which agent answers, and fetching
  // it on the client would render an empty picker first.
  await Promise.all([prefetchWidgets(workspace.id), prefetchAgents(workspace.id)]);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<WidgetsError />}>
        <Suspense fallback={<WidgetsLoading />}>
          <WidgetsScreen />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
