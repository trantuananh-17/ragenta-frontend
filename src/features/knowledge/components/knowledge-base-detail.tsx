"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CircleStop,
  Download,
  FileText,
  MoreHorizontal,
  RefreshCw,
  Settings2,
  Trash2,
} from "lucide-react";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { DetailShell } from "@/components/detail-shell";
import { PageHeader } from "@/components/page-header";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import { formatBytes, formatDateTime, formatNumber } from "@/lib/format";
import { canAdminister, canContribute } from "@/lib/workspace";
import {
  useCancelDocument,
  useDeleteDocument,
  useDeleteKnowledgeBase,
  useDocumentsSuspense,
  useDownloadDocument,
  useKnowledgeBaseSuspense,
  useReindexDocument,
} from "../hooks/knowledge.hook";
import { ACTIVE_DOCUMENT_STATUSES } from "../service/knowledge.service";
import { DocumentProgress, DocumentStatusBadge } from "./document-status";
import { DocumentUpload } from "./document-upload";
import { KnowledgeBaseSettingsDialog } from "./knowledge-base-settings-dialog";

export function KnowledgeBaseDetail({ baseId }: { baseId: string }) {
  const { workspace } = useWorkspace();
  const base = useKnowledgeBaseSuspense(workspace.id, baseId);
  const documents = useDocumentsSuspense(workspace.id, baseId);

  const reindex = useReindexDocument(workspace.id);
  const cancel = useCancelDocument(workspace.id);
  const download = useDownloadDocument(workspace.id);
  const deleteDocument = useDeleteDocument(workspace.id);
  const deleteBase = useDeleteKnowledgeBase(workspace.id);

  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deletingBase, setDeletingBase] = useState(false);
  const [editingSettings, setEditingSettings] = useState(false);

  const mayContribute = canContribute(workspace.role);
  const mayDeleteBase = canAdminister(workspace.role);

  return (
    <DetailShell>
      <PageHeader
        back={{ href: "/knowledge", label: "Knowledge bases" }}
        title={base.data.name}
        description={base.data.description}
        actions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href="/chat">Chat against it</Link>
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!mayContribute}
              onClick={() => setEditingSettings(true)}
            >
              <Settings2 className="size-4" />
              Settings
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!mayDeleteBase}
              onClick={() => setDeletingBase(true)}
            >
              <Trash2 className="size-4" />
              Delete
            </Button>
          </>
        }
      />

      <StatCardGrid>
        <StatCard
          label="Documents"
          value={formatNumber(base.data.documentCount)}
        />
        <StatCard
          label="Chunks"
          value={formatNumber(base.data.chunkCount)}
          hint="Retrievable passages"
        />
        <StatCard
          label="Embedding"
          value={base.data.embeddingModel}
          hint={`${base.data.embeddingProvider} · ${base.data.embeddingDimensions} dimensions, frozen`}
        />
        <StatCard
          label="Chunking"
          value={base.data.parserId}
          hint={`${base.data.chunkTokenSize} tokens, ${base.data.chunkOverlapPercent}% overlap`}
        />
        <StatCard
          label="Retrieval"
          value={`${base.data.topK} passages`}
          hint={
            base.data.rerankModel
              ? `Reranked with ${base.data.rerankModel}`
              : `${Math.round(base.data.vectorWeight * 100)}% meaning, ${Math.round((1 - base.data.vectorWeight) * 100)}% wording`
          }
        />
      </StatCardGrid>

      <DocumentUpload
        workspaceId={workspace.id}
        baseId={baseId}
        disabled={!mayContribute}
      />

      <div className="overflow-hidden rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Chunks</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.data.items.length === 0 && (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  Nothing uploaded yet. A knowledge base with no documents
                  retrieves nothing.
                </TableCell>
              </TableRow>
            )}

            {documents.data.items.map((document) => (
              <TableRow key={document.id}>
                <TableCell className="max-w-[280px]">
                  <Link
                    href={`/knowledge/${baseId}/documents/${document.id}`}
                    className="flex items-center gap-2 hover:text-primary"
                  >
                    <FileText className="size-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{document.name}</span>
                  </Link>
                </TableCell>
                <TableCell className="min-w-[180px]">
                  <DocumentStatusBadge
                    status={document.status}
                    error={document.error}
                  />
                  <DocumentProgress
                    className="mt-1.5"
                    status={document.status}
                    progress={document.progress}
                    message={document.progressMessage}
                  />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatNumber(document.chunkCount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {formatBytes(document.sizeBytes)}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDateTime(document.createdAt)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Actions for ${document.name}`}
                      >
                        <MoreHorizontal className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => download.mutate(document.id)}
                      >
                        <Download className="size-4" />
                        Download original
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!mayContribute}
                        onSelect={() => reindex.mutate({ documentId: document.id })}
                      >
                        <RefreshCw className="size-4" />
                        Re-index
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={
                          !mayContribute ||
                          !ACTIVE_DOCUMENT_STATUSES.includes(document.status)
                        }
                        onSelect={() => cancel.mutate(document.id)}
                      >
                        <CircleStop className="size-4" />
                        Stop indexing
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        disabled={!mayContribute}
                        onSelect={() => setPendingDelete(document.id)}
                      >
                        <Trash2 className="size-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <KnowledgeBaseSettingsDialog
        workspaceId={workspace.id}
        base={base.data}
        open={editingSettings}
        onOpenChange={setEditingSettings}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete this document?"
        description="Its passages leave the index straight away, so answers stop citing it. Answers already given keep the snippets they were built from."
        confirmLabel="Delete"
        destructive
        pending={deleteDocument.isPending}
        onConfirm={() => {
          if (pendingDelete) deleteDocument.mutate(pendingDelete);
          setPendingDelete(null);
        }}
      />

      <ConfirmDialog
        open={deletingBase}
        onOpenChange={setDeletingBase}
        title={`Delete ${base.data.name}?`}
        description="Every document, chunk and vector in it goes, and no re-upload gets the same index back without re-embedding. Conversations that used it stay readable."
        confirmLabel="Delete knowledge base"
        destructive
        pending={deleteBase.isPending}
        onConfirm={() => deleteBase.mutate(baseId)}
      />
    </DetailShell>
  );
}

export function KnowledgeBaseLoading() {
  return (
    <DetailShell>
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
    </DetailShell>
  );
}

export function KnowledgeBaseError() {
  return (
    <DetailShell>
      <p className="text-sm text-muted-foreground">
        This knowledge base could not be loaded. It may have been deleted.
      </p>
    </DetailShell>
  );
}
