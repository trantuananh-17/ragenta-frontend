"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  deleteAttachment,
  deleteConversation,
  stopMessage,
  streamMessage,
  updateConversation,
  uploadAttachment,
  ACCEPTED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  MAX_TURN_ATTACHMENTS,
  type Citation,
  type CreateConversationInput,
  type Message,
  type MessageAttachment,
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
  /** The rewritten question retrieval used, when the server rewrote one. */
  searchedFor: string | null;
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
  // Carried on the optimistic row, not left for the reconcile: an image that
  // appeared only after the invalidate would flash in halfway through the
  // answer it was asked about.
  attachments: MessageAttachment[],
): Message {
  return {
    id: `local-${crypto.randomUUID()}`,
    conversationId,
    role,
    content,
    citations: [],
    attachments,
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
    async (
      input: SendMessageInput,
      /**
       * The uploaded files `input.attachmentIds` names — images and recordings
       * alike. Passed alongside rather than inside the payload because the wire
       * carries ids and the optimistic bubble needs the files themselves.
       */
      attachments: MessageAttachment[] = [],
    ) => {
      if (pending) return;

      const controller = new AbortController();
      abortRef.current = controller;
      messageIdRef.current = null;
      setPending(true);
      setStreaming({
        content: "",
        citations: [],
        phase: "retrieving",
        searchedFor: null,
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
                  localMessage(conversationId, "user", input.content, attachments),
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
          } else if (event.type === "query") {
            setStreaming((current) =>
              current ? { ...current, searchedFor: event.question } : current,
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

/** One file in the composer, from the moment it is chosen or recorded. */
export interface ComposerAttachment {
  /** Stable for the life of the thumbnail; the server id only arrives later. */
  localId: string;
  fileName: string;
  /** What the strip shows: a thumbnail, or a player for a recording. */
  kind: "image" | "audio";
  /**
   * Set once a recording has actually been transcribed. A clip is "ready" as
   * soon as it has uploaded, which is earlier — and a send refuses a recording
   * with no transcript, so uploading is not on its own enough to send one.
   */
  transcribed?: boolean;
  /** An object URL over the chosen file, so the preview is there at once. */
  previewUrl: string;
  status: "uploading" | "ready" | "failed";
  /** Set once the upload has landed. What the send actually refers to. */
  attachment: MessageAttachment | null;
  error: string | null;
}

/**
 * What a chosen file is shown as in the strip, or null for a type a question
 * cannot carry.
 *
 * A drop never passes through the picker's `accept`, so this is the only place
 * a dropped PDF is turned away — before it is uploaded, and before it is
 * labelled an image it is not. A recording has its own way in, so nothing
 * chosen here is audio.
 */
function chosenKind(file: File): ComposerAttachment["kind"] | null {
  return ACCEPTED_ATTACHMENT_TYPES.split(",").includes(file.type) ? "image" : null;
}

/**
 * The files attached to the next question.
 *
 * Uploaded on selection rather than on send, which is what the two-step backend
 * contract is for: the slow part happens while the question is still being
 * typed, and pressing send stays a small JSON request. A failure is therefore
 * visible on its own thumbnail long before anyone commits to the turn, and it
 * takes only itself down — the rest of the batch still sends.
 */
export function useComposerAttachments(workspaceId: string) {
  const [items, setItems] = useState<ComposerAttachment[]>([]);
  // Keyed by localId so removing a thumbnail can cancel the upload behind it,
  // which is what stops a removed image from being stored anyway.
  const uploadsRef = useRef(new Map<string, AbortController>());
  /**
   * The committed list, for the two callers that cannot use a render's copy: a
   * recording is attached from the closure the recording *started* in, so
   * anything chosen while it ran is missing there, and unmount cleanup runs
   * from an effect that must not re-subscribe on every change.
   */
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(
    () => () => {
      // Leaving the composer — switching conversation is one click — must not
      // pin the previews in memory for the life of the tab, nor leave uploads
      // running for a strip that no longer exists.
      for (const item of itemsRef.current) URL.revokeObjectURL(item.previewUrl);
      for (const controller of uploadsRef.current.values()) controller.abort();
      uploadsRef.current.clear();
    },
    [],
  );

  /**
   * Resolves with the stored attachment, or null when it never landed. The
   * return matters only to a recording, which has to be transcribed the moment
   * it is stored; a chosen image is fire-and-forget.
   */
  const upload = useCallback(
    async (localId: string, file: File): Promise<MessageAttachment | null> => {
      const controller = new AbortController();
      uploadsRef.current.set(localId, controller);

      try {
        const attachment = await uploadAttachment(
          workspaceId,
          file,
          controller.signal,
        );
        setItems((current) =>
          current.map((item) =>
            item.localId === localId
              ? { ...item, status: "ready", attachment, error: null }
              : item,
          ),
        );
        return attachment;
      } catch (error) {
        // An abort is the thumbnail having been removed, not a failure.
        if (controller.signal.aborted) return null;
        const description = await errorMessage(error, "The upload failed.");
        setItems((current) =>
          current.map((item) =>
            item.localId === localId
              ? { ...item, status: "failed", error: description }
              : item,
          ),
        );
        toast.error(`${file.name} could not be attached`, {
          description,
        });
        return null;
      } finally {
        uploadsRef.current.delete(localId);
      }
    },
    [workspaceId],
  );

  const add = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;

      const typed: { file: File; kind: ComposerAttachment["kind"] }[] = [];
      for (const file of files) {
        const kind = chosenKind(file);
        if (!kind) {
          toast.error(`${file.name} cannot be attached`, {
            description: "A question carries PNG, JPEG, WebP or GIF images.",
          });
          continue;
        }
        typed.push({ file, kind });
      }
      if (typed.length === 0) return;

      const room = MAX_TURN_ATTACHMENTS - items.length;
      if (room <= 0) {
        toast.error(`A question carries at most ${MAX_TURN_ATTACHMENTS} files.`);
        return;
      }
      if (typed.length > room) {
        toast.error(`Only ${room} more file${room === 1 ? "" : "s"} fit on this question.`);
      }

      // Refused here as well as on the server: the server refusal is the one
      // that counts, but making someone upload 40 MB to be told no is a poor
      // way to spend their connection.
      const chosen = typed.slice(0, room);
      for (const { file } of chosen.filter((entry) => entry.file.size > MAX_ATTACHMENT_BYTES)) {
        toast.error(`${file.name} is too large`, {
          description: `The limit is ${Math.floor(MAX_ATTACHMENT_BYTES / 1024 / 1024)} MB per file.`,
        });
      }

      const accepted = chosen.filter((entry) => entry.file.size <= MAX_ATTACHMENT_BYTES);
      if (accepted.length === 0) return;

      const started = accepted.map((entry) => ({
        localId: crypto.randomUUID(),
        fileName: entry.file.name,
        kind: entry.kind,
        previewUrl: URL.createObjectURL(entry.file),
        status: "uploading" as const,
        attachment: null,
        error: null,
      }));

      setItems((current) => [...current, ...started]);
      started.forEach((item, index) => void upload(item.localId, accepted[index].file));
    },
    [items.length, upload],
  );

  /**
   * A clip recorded in the composer, attached the same way an image is.
   *
   * Awaited rather than fired and forgotten, because the transcript is fetched
   * against the stored attachment: the caller needs the row before it can ask
   * for the text.
   */
  const addRecording = useCallback(
    async (file: File): Promise<MessageAttachment | null> => {
      // The live list, not this render's: the recorder calls back with the
      // closure it was given when recording started, and images chosen while it
      // ran are not in that one — a seventh file would be refused by the server
      // with the whole turn behind it.
      if (itemsRef.current.length >= MAX_TURN_ATTACHMENTS) {
        toast.error(`A question carries at most ${MAX_TURN_ATTACHMENTS} files.`);
        return null;
      }

      const localId = crypto.randomUUID();
      setItems((current) => [
        ...current,
        {
          localId,
          fileName: file.name,
          kind: "audio",
          previewUrl: URL.createObjectURL(file),
          status: "uploading",
          attachment: null,
          error: null,
        },
      ]);

      return upload(localId, file);
    },
    [upload],
  );

  /**
   * A recording became sendable, because its transcript came back.
   *
   * Keyed on the attachment id rather than the local one: transcription is
   * driven by the voice hook, which is handed the uploaded attachment and never
   * sees the composer's own bookkeeping id.
   */
  const markTranscribed = useCallback((attachmentId: string) => {
    setItems((current) =>
      current.map((item) =>
        item.attachment?.id === attachmentId ? { ...item, transcribed: true } : item,
      ),
    );
  }, []);

  /**
   * A recording that could not be transcribed, taken back off the question.
   *
   * The clip only ever reaches the model as its transcript, so one without a
   * transcript is a card that cannot be sent, still occupies one of the six
   * slots, and describes itself as going with words that do not exist. It reads
   * the live list and updates functionally because the voice hook calls back
   * through the closure the *recording* started in, where this item did not yet
   * exist.
   */
  const discardRecording = useCallback(
    (attachmentId: string) => {
      const item = itemsRef.current.find(
        (candidate) => candidate.attachment?.id === attachmentId,
      );
      if (!item) return;

      URL.revokeObjectURL(item.previewUrl);
      void deleteAttachment(workspaceId, attachmentId).catch(() => {});
      setItems((current) =>
        current.filter((candidate) => candidate.localId !== item.localId),
      );
    },
    [workspaceId],
  );

  const remove = useCallback(
    (localId: string) => {
      const item = items.find((candidate) => candidate.localId === localId);
      if (!item) return;

      uploadsRef.current.get(localId)?.abort();
      uploadsRef.current.delete(localId);
      URL.revokeObjectURL(item.previewUrl);
      // Best effort: an attachment not yet bound to a message is deleted, and
      // one the send has already claimed answers 409, which is not a problem
      // worth telling anyone about — it belongs to the message now.
      if (item.attachment) {
        void deleteAttachment(workspaceId, item.attachment.id).catch(() => {});
      }

      setItems((current) =>
        current.filter((candidate) => candidate.localId !== localId),
      );
    },
    [items, workspaceId],
  );

  /**
   * Empty the strip after a send. Deliberately not a delete: an image and a
   * recording both now belong to the message that was just sent, and a voice
   * note is worth keeping beside its transcript — a transcript is a lossy record
   * of what someone actually said, and the audio is the only way to check it.
   */
  const clear = useCallback(() => {
    for (const item of items) {
      URL.revokeObjectURL(item.previewUrl);
    }
    setItems([]);
  }, [items]);

  return {
    items,
    add,
    addRecording,
    markTranscribed,
    discardRecording,
    remove,
    clear,
    /**
     * The ones a send can actually name — images and transcribed recordings
     * alike. A failed upload is simply not among them.
     *
     * A recording reaches the model as its transcript, never as bytes, so the
     * send refuses one that has not been transcribed yet — and a clip counts as
     * ready the moment it uploads, which is earlier than that. `transcribed` is
     * the gate, so a clip still being transcribed is held out of the question
     * rather than failing the whole turn; one whose transcription failed is
     * taken off it altogether by `discardRecording`.
     */
    ready: items.flatMap((item) =>
      item.status === "ready" &&
      item.attachment &&
      (item.kind === "image" || item.transcribed === true)
        ? [item.attachment]
        : [],
    ),
    uploading: items.some((item) => item.status === "uploading"),
    full: items.length >= MAX_TURN_ATTACHMENTS,
  };
}
