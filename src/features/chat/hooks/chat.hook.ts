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
  stopMessage,
  streamMessage,
  updateConversation,
  type Citation,
  type CreateConversationInput,
  type Message,
  type SendMessageInput,
  type UpdateConversationInput,
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
    mutationFn: (input: UpdateConversationInput) =>
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
  /**
   * What the server said it was doing, last. Retrieval runs before a token
   * exists and is the slow, silent part of a turn, so it is worth naming.
   */
  phase: "retrieving" | "generating";
  /** When the question was sent, for the elapsed counter while it runs. */
  startedAt: number;
  /** Set once the server has named the turn, which is what stopping addresses. */
  messageId: string | null;
  /** The user has asked it to stop and the last tokens are still arriving. */
  stopping: boolean;
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
  const messageIdRef = useRef<string | null>(null);

  /**
   * Stop generating, without losing what is on screen.
   *
   * Aborting the fetch is the obvious implementation and it is the wrong one:
   * it kills the connection at the instant the server is trying to save the
   * partial answer, so whether the text survives depends on a race between a
   * database write and a fresh HTTP request. Asking the server to stop instead
   * means the turn ends the ordinary way — the partial answer is written, `done`
   * arrives, and the reconcile below finds a real row.
   *
   * The abort is kept as the fallback for the case the request itself fails, and
   * for a closed tab, where the server has its own recovery.
   */
  const stop = useCallback(() => {
    const messageId = messageIdRef.current;
    if (!messageId) {
      // No id yet: the answer has not been named, so there is nothing on screen
      // worth preserving and the blunt instrument is the only one available.
      abortRef.current?.abort();
      abortRef.current = null;
      return;
    }

    setStreaming((current) => (current ? { ...current, stopping: true } : current));

    void stopMessage(workspaceId, conversationId, messageId).catch(() => {
      abortRef.current?.abort();
      abortRef.current = null;
    });
  }, [conversationId, workspaceId]);

  const send = useCallback(
    async (input: SendMessageInput) => {
      if (pending) return;

      const controller = new AbortController();
      abortRef.current = controller;
      messageIdRef.current = null;
      setPending(true);
      setStreaming({
        content: "",
        citations: [],
        phase: "retrieving",
        startedAt: Date.now(),
        messageId: null,
        stopping: false,
      });

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
          if (event.type === "start") {
            messageIdRef.current = event.messageId;
            setStreaming((current) =>
              current ? { ...current, messageId: event.messageId } : current,
            );
          } else if (event.type === "phase") {
            setStreaming((current) =>
              current ? { ...current, phase: event.phase } : current,
            );
          } else if (event.type === "citations") {
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
        messageIdRef.current = null;
        setPending(false);
        // The server's rows are the truth: they carry the citations, the model
        // and what the turn cost. Awaited *before* the local copy is dropped —
        // clearing first would blank the answer for however long the refetch
        // takes, which on a slow connection is long enough to read as a bug.
        await queryClient.invalidateQueries({
          queryKey: chatKeys.messages(workspaceId, conversationId),
        });
        setStreaming(null);
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
