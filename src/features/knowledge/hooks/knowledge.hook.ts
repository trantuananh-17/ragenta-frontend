"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  useMutation,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api-error";
import { knowledgeKeys, knowledgeOptions } from "../options/knowledge.options";
import {
  createKnowledgeBase,
  deleteDocument,
  deleteKnowledgeBase,
  getDownloadUrl,
  reindexDocument,
  updateKnowledgeBase,
  uploadDocument,
  type CreateKnowledgeBaseInput,
} from "../service/knowledge.service";

export function useKnowledgeBasesSuspense(workspaceId: string) {
  return useSuspenseQuery(knowledgeOptions.bases(workspaceId));
}

export function useKnowledgeBaseSuspense(workspaceId: string, baseId: string) {
  return useSuspenseQuery(knowledgeOptions.base(workspaceId, baseId));
}

export function useDocumentsSuspense(workspaceId: string, baseId: string) {
  return useSuspenseQuery(knowledgeOptions.documents(workspaceId, baseId));
}

export function useDocumentSuspense(workspaceId: string, documentId: string) {
  return useSuspenseQuery(knowledgeOptions.document(workspaceId, documentId));
}

export function useChunksSuspense(
  workspaceId: string,
  documentId: string,
  page: number,
) {
  return useSuspenseQuery(knowledgeOptions.chunks(workspaceId, documentId, page));
}

export function useCreateKnowledgeBase(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateKnowledgeBaseInput) =>
      createKnowledgeBase(workspaceId, input),
    onSuccess: (base) => {
      toast.success("Knowledge base created", {
        description: `Embedding with ${base.embeddingModel}, frozen for its lifetime.`,
      });
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.bases(workspaceId),
      });
      router.push(`/knowledge/${base.id}`);
    },
    onError: async (error) => {
      toast.error("Not created", { description: await errorMessage(error) });
    },
  });
}

export function useUpdateKnowledgeBase(workspaceId: string, baseId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { name?: string; description?: string | null }) =>
      updateKnowledgeBase(workspaceId, baseId, input),
    onSuccess: (base) => {
      toast.success("Knowledge base updated.");
      queryClient.setQueryData(knowledgeKeys.base(workspaceId, baseId), base);
      queryClient.invalidateQueries({
        queryKey: knowledgeKeys.bases(workspaceId),
      });
    },
    onError: async (error) => {
      toast.error("Update refused", { description: await errorMessage(error) });
    },
  });
}

export function useDeleteKnowledgeBase(workspaceId: string) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (baseId: string) => deleteKnowledgeBase(workspaceId, baseId),
    onSuccess: () => {
      toast.success("Knowledge base deleted.");
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all() });
      router.push("/knowledge");
    },
    onError: async (error) => {
      toast.error("Could not delete", {
        description: await errorMessage(error),
      });
    },
  });
}

/**
 * Upload.
 *
 * Files are sent one at a time rather than in parallel: each one is an embedding
 * bill and a worker job, and a dropped folder of thirty would otherwise open
 * thirty concurrent uploads against a 25 MB-per-file API. Progress is per file,
 * which is what a drop zone needs to show.
 */
export function useUploadDocuments(workspaceId: string, baseId: string) {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);

  const mutation = useMutation({
    mutationFn: async (files: File[]) => {
      let succeeded = 0;
      setRemaining(files.length);

      for (const file of files) {
        setUploading(file.name);
        try {
          await uploadDocument(workspaceId, baseId, file);
          succeeded += 1;
        } catch (error) {
          toast.error(`${file.name} was not accepted`, {
            description: await errorMessage(error),
          });
        } finally {
          setRemaining((count) => count - 1);
        }
      }

      setUploading(null);
      return succeeded;
    },
    onSuccess: (succeeded) => {
      if (succeeded > 0) {
        toast.success(
          succeeded === 1 ? "Document queued" : `${succeeded} documents queued`,
          { description: "Parsing, chunking and embedding run in the worker." },
        );
      }
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all() });
    },
  });

  return { ...mutation, uploading, remaining };
}

export function useReindexDocument(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => reindexDocument(workspaceId, documentId),
    onSuccess: () => {
      toast.success("Re-indexing", {
        description: "Every stage replaces what it produced, so this converges.",
      });
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all() });
    },
    onError: async (error) => {
      toast.error("Could not re-index", {
        description: await errorMessage(error),
      });
    },
  });
}

export function useDeleteDocument(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (documentId: string) => deleteDocument(workspaceId, documentId),
    onSuccess: () => {
      toast.success("Document deleted.");
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all() });
    },
    onError: async (error) => {
      toast.error("Could not delete", {
        description: await errorMessage(error),
      });
    },
  });
}

/**
 * Download. The URL is presigned and short-lived, so it is fetched at click time
 * rather than rendered into the page where it would expire while being looked at.
 */
export function useDownloadDocument(workspaceId: string) {
  return useMutation({
    mutationFn: (documentId: string) => getDownloadUrl(workspaceId, documentId),
    onSuccess: ({ url }) => {
      window.open(url, "_blank", "noopener,noreferrer");
    },
    onError: async (error) => {
      toast.error("Could not open the file", {
        description: await errorMessage(error),
      });
    },
  });
}
