"use client";

import { useState } from "react";
import { Download, RefreshCw } from "lucide-react";

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
  useChunksSuspense,
  useDocumentSuspense,
  useDownloadDocument,
  useReindexDocument,
} from "../hooks/knowledge.hook";
import { DocumentStatusBadge } from "./document-status";

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
  const download = useDownloadDocument(workspace.id);

  const mayContribute = canContribute(workspace.role);

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
              disabled={!mayContribute || reindex.isPending}
              onClick={() => reindex.mutate(documentId)}
            >
              <RefreshCw className="size-4" />
              Re-index
            </Button>
          </>
        }
      />

      {document.data.status === "failed" && document.data.error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {document.data.error}
        </div>
      )}

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
        title="Chunks"
        description="Exactly what retrieval can return, in document order."
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
                <div className="mb-1.5 flex items-center gap-2 text-xs text-muted-foreground tabular-nums">
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                    #{chunk.ordinal + 1}
                  </Badge>
                  {formatNumber(chunk.tokenCount)} tokens
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {chunk.content}
                </p>
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
