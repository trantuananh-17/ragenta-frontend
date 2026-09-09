"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal, Trash2 } from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import type { ModelSelection } from "@/features/models/service/models.service";
import {
  useConversationSuspense,
  useDeleteConversation,
  useMessagesSuspense,
  useSendMessage,
  useUpdateConversation,
} from "../hooks/chat.hook";
import {
  peekPendingQuestion,
  takePendingQuestion,
} from "../lib/pending-question";
import { ChatComposer } from "./chat-composer";
import { ChatMessage, StreamingMessage } from "./chat-message";
import { KnowledgeBasePicker, ModelPicker } from "./chat-pickers";
import {
  DocumentScopePicker,
  ProjectPicker,
  RetrievalSettingsPicker,
} from "./retrieval-pickers";
import type { MessageAttachment, SearchMode } from "../service/chat.service";

/** Omitted rather than empty, so a turn without images sends no key at all. */
function attachmentIds(attachments: MessageAttachment[]): string[] | undefined {
  return attachments.length > 0
    ? attachments.map((attachment) => attachment.id)
    : undefined;
}

/**
 * One thread.
 *
 * The transcript scrolls, the composer is pinned. Auto-scroll follows the answer
 * only while the reader is already at the bottom — yanking the view back down
 * while someone is reading an earlier passage is the single most irritating
 * thing a streaming chat can do.
 */
export function ConversationView({ conversationId }: { conversationId: string }) {
  const { workspace, can } = useWorkspace();
  const conversation = useConversationSuspense(workspace.id, conversationId);
  const messages = useMessagesSuspense(workspace.id, conversationId);
  const updateConversation = useUpdateConversation(workspace.id, conversationId);
  const deleteConversation = useDeleteConversation(workspace.id);
  const { send, stop, streaming, pending } = useSendMessage(
    workspace.id,
    conversationId,
  );

  // A model picked on the blank slate is already chosen before this screen
  // mounts, so it is the initial state rather than something assigned later.
  const [model, setModel] = useState<ModelSelection | null>(
    () => peekPendingQuestion(conversationId)?.model ?? null,
  );
  // Which files this thread is currently scoped to. Kept in component state
  // rather than on the conversation: it is a lens on the next question, not a
  // property of the thread, and persisting it would silently narrow every later
  // answer to whatever someone once ticked.
  const [documentIds, setDocumentIds] = useState<string[]>([]);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  // The question typed on the blank-slate screen, asked as soon as the thread it
  // created is on screen. Taking it clears it, so a reload does not re-ask.
  useEffect(() => {
    const question = takePendingQuestion(conversationId);
    if (!question) return;
    void send(
      {
        content: question.content,
        model: question.model ?? undefined,
        attachmentIds: attachmentIds(question.attachments),
      },
      question.attachments,
    );
    // Runs once per conversation; `send` is stable per conversation id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  // `pending` is in the dependencies as well as the content: the reveal is
  // paced a little behind the stream, so the last words appear when the turn
  // ends rather than when the last delta arrived, and without this the tail of
  // a long answer settles just below the fold.
  useEffect(() => {
    if (!atBottomRef.current) return;
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.data.items.length, streaming?.content, pending]);

  const mayChat = can("chat.send");

  /**
   * The streamed answer is dropped only once its saved row is on screen, and the
   * two are never shown at the same time.
   *
   * Clearing the local copy the moment the stream ends would blank the answer
   * for as long as the refetch takes; clearing it after would show the same text
   * twice for a frame. Keying on the id the server sent at the start of the turn
   * removes the ordering question entirely.
   */
  const streamedRowArrived =
    streaming?.messageId != null &&
    messages.data.items.some((message) => message.id === streaming.messageId);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b bg-background px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-sm font-medium">
            {conversation.data.title}
          </h1>
          {conversation.data.knowledgeBaseId ? (
            <Badge variant="secondary" className="shrink-0 text-[11px]">
              grounded
            </Badge>
          ) : (
            <Badge variant="outline" className="shrink-0 text-[11px]">
              no retrieval
            </Badge>
          )}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Conversation actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              disabled={!mayChat}
              onSelect={() => setConfirmDelete(true)}
            >
              <Trash2 className="size-4" />
              Delete conversation
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div
        ref={scrollRef}
        onScroll={(event) => {
          const element = event.currentTarget;
          atBottomRef.current =
            element.scrollHeight - element.scrollTop - element.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {/*
          `space-y-6` is also the clearance the hover stamp needs: it hangs
          about 11px below its own message and takes no layout, so the 24px gap
          leaves it nearer the message it labels than the next one. Tightening
          this would put a question's time under the answer that follows it.
        */}
        <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
          {messages.data.items.map((message, index) => {
            const previous = messages.data.items[index - 1];
            return (
              <ChatMessage
                key={message.id}
                message={message}
                askedAt={previous?.role === "user" ? previous.createdAt : undefined}
              />
            );
          })}
          {streaming && !streamedRowArrived && (
            <StreamingMessage
              content={streaming.content}
              citations={streaming.citations}
              phase={streaming.phase}
              searchedFor={streaming.searchedFor}
              grounded={conversation.data.knowledgeBaseId !== null}
              // The answer outlives the stream by however long the refetch
              // takes, so `pending` — not the presence of `streaming` — is what
              // says tokens are still arriving, and what makes the last words
              // appear the moment the turn ends instead of a frame later.
              live={pending}
              stopping={streaming.stopping}
            />
          )}
        </div>
      </div>

      <div className="border-t bg-background px-4 py-3">
        <div className="mx-auto w-full max-w-3xl">
          <ChatComposer
            autoFocus
            pending={pending}
            stopping={streaming?.stopping}
            onStop={stop}
            disabled={!mayChat}
            disabledReason="You can read this workspace but not spend its credits."
            model={model}
            onSubmit={({ content, attachments }) =>
              void send(
                {
                  content,
                  model: model ?? undefined,
                  documentIds: documentIds.length > 0 ? documentIds : undefined,
                  attachmentIds: attachmentIds(attachments),
                },
                attachments,
              )
            }
            toolbar={
              <>
                <KnowledgeBasePicker
                  value={conversation.data.knowledgeBaseId}
                  disabled={pending}
                  onChange={(knowledgeBaseId) => {
                    // The scope belonged to the old base's documents; carrying
                    // it over would filter the new base by ids it does not have,
                    // which retrieves nothing and looks like a broken answer.
                    setDocumentIds([]);
                    updateConversation.mutate({ knowledgeBaseId });
                  }}
                />
                <ProjectPicker
                  value={conversation.data.projectId}
                  disabled={pending}
                  onChange={(projectId) => updateConversation.mutate({ projectId })}
                />
                <DocumentScopePicker
                  knowledgeBaseId={conversation.data.knowledgeBaseId}
                  value={documentIds}
                  onChange={setDocumentIds}
                  disabled={pending}
                />
                <RetrievalSettingsPicker
                  mode={conversation.data.searchMode as SearchMode}
                  topK={conversation.data.topK}
                  groundedOnly={conversation.data.groundedOnly}
                  refineFollowUps={conversation.data.refineFollowUps}
                  disabled={pending || !conversation.data.knowledgeBaseId}
                  onChange={({ mode, topK, groundedOnly, refineFollowUps }) =>
                    updateConversation.mutate({
                      ...(mode ? { searchMode: mode } : {}),
                      ...(topK !== undefined ? { topK } : {}),
                      ...(groundedOnly !== undefined ? { groundedOnly } : {}),
                      ...(refineFollowUps !== undefined
                        ? { refineFollowUps }
                        : {}),
                    })
                  }
                />
                <ModelPicker value={model} onChange={setModel} disabled={pending} />
              </>
            }
          />
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this conversation?"
        description="The thread and every answer in it go, along with the citations that show what each answer was built from. The documents themselves are untouched."
        confirmLabel="Delete"
        destructive
        pending={deleteConversation.isPending}
        onConfirm={() => deleteConversation.mutate(conversationId)}
      />
    </div>
  );
}
