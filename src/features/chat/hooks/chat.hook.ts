"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api-error";
import { workspaceKeys } from "@/features/workspace/options/workspace.options";
import { chatKeys, chatOptions } from "../options/chat.options";
import {
  createConversation,
  deleteConversation,
  streamMessage,
  updateConversation,
  type Citation,
  type CreateConversationInput,
  type Message,
  type SendMessageInput,
} from "../service/chat.service";

export function useConversationsSuspense(workspaceId: string) {
  return useSuspenseQuery(chatOptions.conversations(workspaceId));
}

export function useConversationSuspense(
  workspaceId: string,
  conversationId: string,
) {
  return useSuspenseQuery(chatOptions.conversation(workspaceId, conversationId));
}

export function useMessagesSuspense(
  workspaceId: string,
  conversationId: string,
) {
  return useSuspenseQuery(chatOptions.messages(workspaceId, conversationId));
}

export function useCreateConversation(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateConversationInput) =>
      createConversation(workspaceId, input),
    onSuccess: (conversation) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(workspaceId),
      });
      router.push(`/chat/${conversation.id}`);
    },
    onError: async (error) => {
      toast.error("Could not start a conversation", {
        description: await errorMessage(error),
      });
    },
  });
}

export function useUpdateConversation(
  workspaceId: string,
  conversationId: string,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { title?: string; knowledgeBaseId?: string | null }) =>
      updateConversation(workspaceId, conversationId, input),
    onSuccess: (conversation) => {
      queryClient.setQueryData(
        chatKeys.conversation(workspaceId, conversationId),
        conversation,
      );
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(workspaceId),
      });
    },
    onError: async (error) => {
      toast.error("Change refused", { description: await errorMessage(error) });
    },
  });
}

export function useDeleteConversation(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (conversationId: string) =>
      deleteConversation(workspaceId, conversationId),
    onSuccess: () => {
      toast.success("Conversation deleted.");
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(workspaceId),
      });
      router.push("/chat");
    },
    onError: async (error) => {
      toast.error("Could not delete", {
        description: await errorMessage(error),
      });
    },
  });
}

/** The assistant turn while it is still arriving. Null when nothing is running. */
export interface StreamingTurn {
  content: string;
  citations: Citation[];
}

function localMessage(
  conversationId: string,
  role: Message["role"],
  content: string,
): Message {
  return {
    id: `local-${crypto.randomUUID()}`,
    conversationId,
    role,
    content,
    citations: [],
    provider: null,
    model: null,
    inputTokens: 0,
    outputTokens: 0,
    credits: 0,
    status: "complete",
    error: null,
    userId: null,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Sending a turn.
 *
 * The user's own message is written into the cache immediately — the backend
 * persists it as part of preparing the turn, so showing it before the first
 * token is not a lie, and waiting for a round trip to echo back what someone
 * just typed reads as a stall.
 *
 * The answer accumulates in local state rather than in the query cache: a
 * setQueryData per token would re-render every subscriber of the list on every
 * token. It is reconciled into the cache once, when the stream finishes, by
 * invalidating and letting the server's own rows win — the persisted message
 * carries the citations, the model and the credits, which the deltas do not.
 */
export function useSendMessage(workspaceId: string, conversationId: string) {
  const queryClient = useQueryClient();
  const [streaming, setStreaming] = useState<StreamingTurn | null>(null);
  const [pending, setPending] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const send = useCallback(
    async (input: SendMessageInput) => {
      if (pending) return;

      const controller = new AbortController();
      abortRef.current = controller;
      setPending(true);
      setStreaming({ content: "", citations: [] });

      queryClient.setQueryData(
        chatKeys.messages(workspaceId, conversationId),
        (current: { items: Message[]; total: number; limit: number; offset: number } | undefined) =>
          current
            ? {
                ...current,
                items: [
                  ...current.items,
                  localMessage(conversationId, "user", input.content),
                ],
                total: current.total + 1,
              }
            : current,
      );

      try {
        for await (const event of streamMessage(
          workspaceId,
          conversationId,
          input,
          controller.signal,
        )) {
          if (event.type === "citations") {
            setStreaming((current) =>
              current ? { ...current, citations: event.citations } : current,
            );
          } else if (event.type === "delta") {
            setStreaming((current) =>
              current
                ? { ...current, content: current.content + event.text }
                : current,
            );
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      } catch (error) {
        // An abort is the user pressing stop, not a failure.
        if (!controller.signal.aborted) {
          toast.error("The answer stopped", {
            description: await errorMessage(error),
          });
        }
      } finally {
        abortRef.current = null;
        setPending(false);
        setStreaming(null);
        // The server's rows are the truth: they carry the citations, the model
        // and what the turn cost.
        await queryClient.invalidateQueries({
          queryKey: chatKeys.messages(workspaceId, conversationId),
        });
        queryClient.invalidateQueries({
          queryKey: chatKeys.conversations(workspaceId),
        });
        // A turn spends credits, so the balance in the shell is now stale.
        queryClient.invalidateQueries({
          queryKey: workspaceKeys.overview(workspaceId),
        });
      }
    },
    [conversationId, pending, queryClient, workspaceId],
  );

  return { send, stop, streaming, pending };
}
