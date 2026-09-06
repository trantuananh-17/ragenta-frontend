"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { BookOpen, Sparkles } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { knowledgeOptions } from "@/features/knowledge/options/knowledge.options";
import { canContribute } from "@/lib/workspace";
import {
  useWorkspace,
} from "@/features/workspace/components/workspace-provider";
import { useCreateConversation } from "../hooks/chat.hook";
import { setPendingQuestion } from "../lib/pending-question";
import { ChatComposer } from "./chat-composer";
import { KnowledgeBasePicker } from "./chat-pickers";
import { ProjectPicker } from "./retrieval-pickers";

/**
 * The blank slate.
 *
 * The first question creates the conversation and then navigates into it, rather
 * than asking someone to name a thread before they have said anything — the
 * title comes from what they asked, and an empty conversation nobody returns to
 * is just a row in the sidebar.
 */
export function NewChat() {
  const { workspace } = useWorkspace();
  const create = useCreateConversation(workspace.id);
  const bases = useQuery(knowledgeOptions.bases(workspace.id));
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const mayChat = canContribute(workspace.role);
  const hasBases = (bases.data?.items.length ?? 0) > 0;

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col justify-center gap-6 px-4 py-10">
      <div className="space-y-2 text-center">
        <Sparkles className="mx-auto size-6 text-primary" />
        <h1 className="text-2xl font-semibold tracking-tight">
          Ask your documents
        </h1>
        <p className="text-sm text-muted-foreground">
          Answers are grounded in the knowledge base you pick, and every claim
          carries the passage it came from.
        </p>
      </div>

      <ChatComposer
        autoFocus
        pending={create.isPending}
        disabled={!mayChat}
        disabledReason="Your role in this workspace can read but not spend its credits."
        onSubmit={({ content }) =>
          create.mutate(
            {
              // The first line of the question, so the sidebar reads as a list
              // of questions rather than a list of "New conversation".
              title: content.slice(0, 80),
              knowledgeBaseId,
              projectId,
            },
            {
              // Handed to the conversation screen, which sends it as soon as
              // it mounts.
              onSuccess: (conversation) =>
                setPendingQuestion(conversation.id, content),
            },
          )
        }
        toolbar={
          <>
            <KnowledgeBasePicker
              value={knowledgeBaseId}
              onChange={setKnowledgeBaseId}
              disabled={create.isPending}
            />
            <ProjectPicker
              value={projectId}
              onChange={setProjectId}
              disabled={create.isPending}
            />
          </>
        }
      />

      {!hasBases && bases.isSuccess && (
        <div className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          <BookOpen className="mx-auto mb-2 size-5" />
          <p>
            This workspace has no knowledge base yet, so answers will come from
            the model alone.
          </p>
          <Link
            href="/knowledge"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Create one
          </Link>
        </div>
      )}
    </div>
  );
}
