"use client";

import { useState } from "react";
import { CircleStop, Download, RefreshCw } from "lucide-react";

import { DetailShell, DetailList, DetailSection } from "@/components/detail-shell";
import { EntityPagination } from "@/components/entity-components";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import { formatBytes, formatDateTime, formatNumber } from "@/lib/format";
import { totalPages } from "@/lib/pagination";
import { canContribute } from "@/lib/workspace";
import {
  useCancelDocument,
  useChunksSuspense,
  useDocumentSuspense,
  useDownloadDocument,
  useIngestionTasks,
  useReindexDocument,
} from "../hooks/knowledge.hook";
import { ACTIVE_DOCUMENT_STATUSES } from "../service/knowledge.service";
import { ChunkingMethodPicker, INHERIT } from "./chunking-method-picker";
import { DocumentProgress, DocumentStatusBadge } from "./document-status";

/**
 * What the ingestion actually produced.
 *
 * The chunk list is the honest view of a knowledge base: retrieval can only ever
 * return one of these passages, so an answer that misses something is usually
 * explained here — by a chunk that split mid-argument, or by a document that
 * produced none at all.
 */
export function DocumentDetail({
  baseId,
  documentId,
}: {
  baseId: string;
  documentId: string;
}) {
  const { workspace } = useWorkspace();
  const [page, setPage] = useState(1);
  const document = useDocumentSuspense(workspace.id, documentId);
  const chunks = useChunksSuspense(workspace.id, documentId, page);
  const reindex = useReindexDocument(workspace.id);
  const cancel = useCancelDocument(workspace.id);
  const download = useDownloadDocument(workspace.id);
  const tasks = useIngestionTasks(
    workspace.id,
    documentId,
    document.data.status,
  );

  // `INHERIT` means "whatever the knowledge base says", which is what a document
  // with no override of its own already does.
  const [parserId, setParserId] = useState(document.data.parserId ?? INHERIT);

  const mayContribute = canContribute(workspace.role);
  const running = ACTIVE_DOCUMENT_STATUSES.includes(document.data.status);

  return (
    <DetailShell>
      <PageHeader
        back={{ href: `/knowledge/${baseId}`, label: "Back to the knowledge base" }}
        title={document.data.name}
        badges={
          <>
            <DocumentStatusBadge
              status={document.data.status}
              error={document.data.error}
            />
            <Badge variant="outline">{document.data.mimeType}</Badge>
          </>
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => download.mutate(documentId)}
            >
              <Download className="size-4" />
              Original
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!mayContribute || reindex.isPending || running}
              onClick={() =>
                reindex.mutate({
                  documentId,
                  parserId: parserId === INHERIT ? null : parserId,
                })
              }
            >
              <RefreshCw className="size-4" />
              Re-index
            </Button>
            {running && (
              <Button
                variant="outline"
                size="sm"
                disabled={!mayContribute || document.data.cancelRequested}
                onClick={() => cancel.mutate(documentId)}
              >
                <CircleStop className="size-4" />
                {document.data.cancelRequested ? "Stopping" : "Stop"}
              </Button>
            )}
          </>
        }
      />

      {document.data.status === "failed" && document.data.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {document.data.error}
        </div>
      )}

      <DocumentProgress
        status={document.data.status}
        progress={document.data.progress}
        message={document.data.progressMessage}
      />

      <DetailSection title="Ingestion">
        <DetailList
          items={[
            { label: "Chunks", value: formatNumber(document.data.chunkCount) },
            { label: "Tokens", value: formatNumber(document.data.tokenCount) },
            { label: "Size", value: formatBytes(document.data.sizeBytes) },
            {
              label: "Uploaded",
              value: formatDateTime(document.data.createdAt),
            },
            {
              label: "Indexed",
              value: document.data.indexedAt
                ? formatDateTime(document.data.indexedAt)
                : "Not yet",
            },
          ]}
        />
      </DetailSection>

      <DetailSection
        title="Chunking"
        description="How this file is cut into passages. Changing it takes effect on the next re-index."
      >
        <div className="max-w-md">
          <ChunkingMethodPicker
            workspaceId={workspace.id}
            value={parserId}
            onChange={setParserId}
            disabled={!mayContribute || running}
            allowInherit
          />
        </div>
      </DetailSection>

      {(tasks.data?.items.length ?? 0) > 0 && (
        <DetailSection
          title="Ingestion plan"
          description="One row per page range. A range whose settings did not change since the last run is reused rather than re-embedded, so it costs nothing."
        >
          <div className="space-y-2">
            {tasks.data?.items.map((task) => (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Badge variant="secondary" className="h-5 shrink-0 text-[11px]">
                    {task.fromPage === null
                      ? "whole file"
                      : `pages ${task.fromPage}–${task.toPage}`}
                  </Badge>
                  <span className="truncate text-xs text-muted-foreground">
                    {task.error ?? task.progressMessage ?? "—"}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground tabular-nums">
                  <span>{formatNumber(task.chunkCount)} chunks</span>
                  <Badge
                    variant={task.status === "failed" ? "destructive" : "outline"}
                    className="h-5 text-[11px]"
                  >
                    {task.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      <DetailSection
        title="Chunks"
        description="Exactly what retrieval can return, in document order. A summary is written by a model over several passages, not quoted from the document."
      >
        {chunks.data.items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No chunks. Either ingestion has not reached this document yet, or it
            produced no readable text.
          </p>
        ) : (
          <div className="space-y-3">
            {chunks.data.items.map((chunk) => (
              <div key={chunk.id} className="rounded-md border p-3">
                <div className="mb-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground tabular-nums">
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                    #{chunk.ordinal + 1}
                  </Badge>
                  {chunk.kind !== "passage" && (
                    <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                      {chunk.kind}
                    </Badge>
                  )}
                  {chunk.fromPage !== null && (
                    <span>
                      {chunk.toPage && chunk.toPage !== chunk.fromPage
                        ? `pages ${chunk.fromPage}–${chunk.toPage}`
                        : `page ${chunk.fromPage}`}
                    </span>
                  )}
                  {formatNumber(chunk.tokenCount)} tokens
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {chunk.content}
                </p>
                {(chunk.keywords.length > 0 || chunk.questions.length > 0) && (
                  <div className="mt-2 space-y-1 border-t pt-2">
                    {chunk.keywords.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Keywords</span>{" "}
                        {chunk.keywords.join(", ")}
                      </p>
                    )}
                    {chunk.questions.map((question) => (
                      <p key={question} className="text-xs text-muted-foreground">
                        {question}
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <EntityPagination
              page={page}
              totalPages={totalPages(chunks.data.total, chunks.data.limit)}
              onPageChange={setPage}
              infoText={`${formatNumber(chunks.data.total)} chunks`}
            />
          </div>
        )}
      </DetailSection>
    </DetailShell>
  );
}

export function DocumentLoading() {
  return (
    <DetailShell>
      <Skeleton className="h-8 w-72" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-64 w-full" />
    </DetailShell>
  );
}

export function DocumentError() {
  return (
    <DetailShell>
      <p className="text-sm text-muted-foreground">
        This document could not be loaded.
      </p>
    </DetailShell>
  );
}
