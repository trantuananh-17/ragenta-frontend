import { queryOptions } from "@tanstack/react-query";

import {
  getConversation,
  getConversations,
  getMessages,
} from "../service/chat.service";

export const chatKeys = {
  all: () => ["chat"] as const,
  conversations: (workspaceId: string) =>
    [...chatKeys.all(), "conversations", workspaceId] as const,
  conversation: (workspaceId: string, conversationId: string) =>
    [...chatKeys.all(), "conversation", workspaceId, conversationId] as const,
  messages: (workspaceId: string, conversationId: string) =>
    [...chatKeys.all(), "messages", workspaceId, conversationId] as const,
};

export const chatOptions = {
  conversations: (workspaceId: string) =>
    queryOptions({
      queryKey: chatKeys.conversations(workspaceId),
      queryFn: () => getConversations(workspaceId),
    }),
  conversation: (workspaceId: string, conversationId: string) =>
    queryOptions({
      queryKey: chatKeys.conversation(workspaceId, conversationId),
      queryFn: () => getConversation(workspaceId, conversationId),
    }),
  messages: (workspaceId: string, conversationId: string) =>
    queryOptions({
      queryKey: chatKeys.messages(workspaceId, conversationId),
      queryFn: () => getMessages(workspaceId, conversationId),
      // The turn that just streamed is already in the cache, written by the
      // stream itself. Refetching on focus would replace it with the same rows.
      staleTime: 30_000,
    }),
};
