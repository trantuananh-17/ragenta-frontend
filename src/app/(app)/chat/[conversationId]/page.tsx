import { Suspense } from "react";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

import {
  ChatError,
  ChatLoading,
  ConversationView,
} from "@/features/chat/components";
import { prefetchConversation } from "@/features/chat/server/prefetch";
import { getQueryClient } from "@/lib/get-query-client";
import { requireWorkspace } from "@/lib/workspace";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const workspace = await requireWorkspace();
  await prefetchConversation(workspace.id, conversationId);

  return (
    <HydrationBoundary state={dehydrate(getQueryClient())}>
      <ErrorBoundary fallback={<ChatError />}>
        <Suspense fallback={<ChatLoading />}>
          <ConversationView conversationId={conversationId} />
        </Suspense>
      </ErrorBoundary>
    </HydrationBoundary>
  );
}
