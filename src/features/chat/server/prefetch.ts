import "server-only";

import { getQueryClient } from "@/lib/get-query-client";
import { chatOptions } from "../options/chat.options";

export async function prefetchConversations(workspaceId: string) {
  await getQueryClient().prefetchQuery(chatOptions.conversations(workspaceId));
}

export async function prefetchConversation(
  workspaceId: string,
  conversationId: string,
) {
  const queryClient = getQueryClient();
  await Promise.all([
    queryClient.prefetchQuery(
      chatOptions.conversation(workspaceId, conversationId),
    ),
    queryClient.prefetchQuery(chatOptions.messages(workspaceId, conversationId)),
  ]);
}
