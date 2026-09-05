"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, FileText, Layers } from "lucide-react";

import {
  EntityContainer,
  EntityEmptyView,
  EntityHeader,
} from "@/components/entity-components";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import { formatNumber } from "@/lib/format";
import { canContribute } from "@/lib/workspace";
import { useKnowledgeBasesSuspense } from "../hooks/knowledge.hook";
import { CreateKnowledgeBaseDialog } from "./create-knowledge-base-dialog";

/**
 * Cards rather than a table: a knowledge base is chosen by what is in it, and
 * the two counts that say that — documents and retrievable passages — read
 * better as a pair of figures than as two more columns.
 */
export function KnowledgeBasesScreen() {
  const { workspace } = useWorkspace();
  const { data } = useKnowledgeBasesSuspense(workspace.id);
  const [creating, setCreating] = useState(false);
  const mayCreate = canContribute(workspace.role);

  return (
    <>
      <EntityContainer
        header={
          <EntityHeader
            title="Knowledge bases"
            description="Sets of documents your answers are grounded in. Each one is pinned to the embedding model it was created with."
            newButtonLabel="New knowledge base"
            disabled={!mayCreate}
            onNew={() => setCreating(true)}
          />
        }
      >
        {data.items.length === 0 ? (
          <EntityEmptyView
            icon={<BookOpen />}
            title="No knowledge bases yet"
            message="Upload documents into one and chat can cite them. Without one, answers come from the model alone."
            newLabel="New knowledge base"
            disabled={!mayCreate}
            onNew={mayCreate ? () => setCreating(true) : undefined}
          />
        ) : (
          <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((base) => (
              <Link
                key={base.id}
                href={`/knowledge/${base.id}`}
                className="group rounded-lg border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="truncate font-medium group-hover:text-primary">
                    {base.name}
                  </h2>
                  <BookOpen className="size-4 shrink-0 text-muted-foreground" />
                </div>
                <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
                  {base.description || "No description."}
                </p>
                <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground tabular-nums">
                  <span className="flex items-center gap-1">
                    <FileText className="size-3.5" />
                    {formatNumber(base.documentCount)} docs
                  </span>
                  <span className="flex items-center gap-1">
                    <Layers className="size-3.5" />
                    {formatNumber(base.chunkCount)} chunks
                  </span>
                </div>
                <p className="mt-2 truncate text-[11px] text-muted-foreground">
                  {base.embeddingModel} · {base.embeddingDimensions}d ·{" "}
                  {base.chunkTokenSize} tokens / {base.chunkOverlapPercent}%
                </p>
              </Link>
            ))}
          </div>
        )}
      </EntityContainer>

      <CreateKnowledgeBaseDialog
        workspaceId={workspace.id}
        open={creating}
        onOpenChange={setCreating}
      />
    </>
  );
}

export function KnowledgeBasesLoading() {
  return (
    <div className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
      {[0, 1, 2].map((card) => (
        <Skeleton key={card} className="h-36 rounded-lg" />
      ))}
    </div>
  );
}

export function KnowledgeBasesError() {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
      Knowledge bases could not be loaded.
    </div>
  );
}
