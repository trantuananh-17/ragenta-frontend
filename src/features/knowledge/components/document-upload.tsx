"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useUploadDocuments } from "../hooks/knowledge.hook";
import { MAX_UPLOAD_BYTES } from "../service/knowledge.service";
import { ChunkingMethodPicker, INHERIT } from "./chunking-method-picker";

/** What the extractor can actually read. Anything else fails in the worker. */
const ACCEPTED = ".pdf,.docx,.txt,.md,.html,.htm,.csv,.tsv,.json,.eml";

function tooLarge(file: File) {
  return file.size > MAX_UPLOAD_BYTES;
}

/**
 * The drop zone.
 *
 * Oversized files are refused here as well as on the server: the server refusal
 * is the one that counts, but making someone upload 80 MB to be told no is a
 * poor way to spend their connection.
 */
export function DocumentUpload({
  workspaceId,
  baseId,
  disabled,
}: {
  workspaceId: string;
  baseId: string;
  disabled?: boolean;
}) {
  const upload = useUploadDocuments(workspaceId, baseId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  // Per-batch, not per-file: a drop of thirty files is one kind of document,
  // and asking for a method thirty times would be worse than not offering it.
  const [parserId, setParserId] = useState(INHERIT);

  const accept = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const chosen = Array.from(files);
    const oversized = chosen.filter(tooLarge);
    const allowed = chosen.filter((file) => !tooLarge(file));

    for (const file of oversized) {
      toast.error(`${file.name} is too large`, {
        description: `The limit is ${Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB per file.`,
      });
    }

    if (allowed.length > 0) {
      upload.mutate({
        files: allowed,
        parserId: parserId === INHERIT ? undefined : parserId,
      });
    }
  };

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) accept(event.dataTransfer.files);
      }}
      className={cn(
        "rounded-lg border border-dashed bg-background p-6 text-center transition-colors",
        dragging && "border-primary bg-accent/40",
        disabled && "opacity-60",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={ACCEPTED}
        className="hidden"
        onChange={(event) => {
          accept(event.target.files);
          // Cleared so choosing the same file twice fires a change both times.
          event.target.value = "";
        }}
      />

      <UploadCloud className="mx-auto size-6 text-muted-foreground" />

      {upload.isPending ? (
        <div className="mt-2 space-y-1">
          <p className="text-sm font-medium">Uploading {upload.uploading}</p>
          <p className="text-xs text-muted-foreground">
            {upload.remaining} left. Files go one at a time — each is a worker
            job and an embedding bill.
          </p>
        </div>
      ) : (
        <div className="mt-2 space-y-1">
          <p className="text-sm font-medium">
            Drop files here, or{" "}
            <Button
              variant="link"
              className="h-auto p-0 align-baseline"
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
            >
              browse
            </Button>
          </p>
          <p className="text-xs text-muted-foreground">
            PDF, DOCX, TXT, Markdown, HTML, CSV, TSV, JSON or EML, up to{" "}
            {Math.floor(MAX_UPLOAD_BYTES / 1024 / 1024)} MB each. A scanned PDF
            has no text layer and will fail — there is no OCR yet.
          </p>
        </div>
      )}

      <div className="mx-auto mt-4 max-w-sm text-left">
        <Label htmlFor="upload-parser" className="text-xs">
          Chunking method for this batch
        </Label>
        <div className="mt-1.5">
          <ChunkingMethodPicker
            id="upload-parser"
            workspaceId={workspaceId}
            value={parserId}
            onChange={setParserId}
            disabled={disabled || upload.isPending}
            allowInherit
          />
        </div>
      </div>
    </div>
  );
}
