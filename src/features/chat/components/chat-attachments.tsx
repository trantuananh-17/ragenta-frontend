"use client";

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useWorkspaceId } from "@/features/workspace/components/workspace-provider";
import { cn } from "@/lib/utils";
import type { ComposerAttachment } from "../hooks/chat.hook";
import {
  attachmentContentUrl,
  type MessageAttachment,
} from "../service/chat.service";

/**
 * Reserves the thumbnail's box before a byte of it has arrived.
 *
 * Undefined when the header gave no size — a made-up ratio would shift the
 * transcript once the real image landed, which is the thing this exists to
 * prevent.
 */
function aspectRatio(attachment: MessageAttachment): string | undefined {
  if (!attachment.width || !attachment.height) return undefined;
  return `${attachment.width} / ${attachment.height}`;
}

/**
 * The files on a sent question.
 *
 * The `src` is our own content endpoint, which answers 302 to a short-lived
 * presigned URL. Pointing an `<img>` — or an `<audio>` — straight at it is
 * deliberate: the browser sends the session cookie to our origin and follows the
 * redirect itself, so the bytes never pass through JavaScript and nothing has to
 * hold a blob alive.
 */
export function MessageAttachments({
  attachments,
}: {
  attachments: MessageAttachment[];
}) {
  const workspaceId = useWorkspaceId();
  const [opened, setOpened] = useState<MessageAttachment | null>(null);

  if (attachments.length === 0) return null;

  const recordings = attachments.filter(
    (attachment) => attachment.kind === "audio",
  );
  const images = attachments.filter(
    (attachment) => attachment.kind !== "audio",
  );

  return (
    <>
      {recordings.map((attachment) => (
        <audio
          key={attachment.id}
          controls
          preload="none"
          title={attachment.fileName}
          src={attachmentContentUrl(workspaceId, attachment.id)}
          className="h-9 w-full max-w-[20rem]"
        />
      ))}

      <div className="flex flex-wrap justify-end gap-2">
        {images.map((attachment) => (
          <button
            key={attachment.id}
            type="button"
            title={attachment.fileName}
            onClick={() => setOpened(attachment)}
            className="overflow-hidden rounded-xl border bg-muted transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/20 focus-visible:outline-none"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- the src is a
                redirect to a short-lived presigned URL on a host the optimizer
                cannot be configured for, and this app uses next/image nowhere. */}
            <img
              src={attachmentContentUrl(workspaceId, attachment.id)}
              alt={attachment.fileName}
              width={attachment.width ?? undefined}
              height={attachment.height ?? undefined}
              style={{ aspectRatio: aspectRatio(attachment) }}
              className="h-32 w-auto max-w-[14rem] object-cover"
            />
          </button>
        ))}
      </div>

      <Dialog
        open={opened !== null}
        onOpenChange={(open) => {
          if (!open) setOpened(null);
        }}
      >
        <DialogContent className="sm:max-w-3xl">
          <DialogTitle className="truncate pr-8 text-sm font-medium">
            {opened?.fileName}
          </DialogTitle>
          {opened && (
            /* eslint-disable-next-line @next/next/no-img-element -- as above. */
            <img
              src={attachmentContentUrl(workspaceId, opened.id)}
              alt={opened.fileName}
              width={opened.width ?? undefined}
              height={opened.height ?? undefined}
              className="max-h-[75vh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * The strip above the question box, while the images are still being uploaded.
 *
 * Each thumbnail shows its own upload: one that failed says so and can be
 * dropped, and the rest of the batch is still sendable — a failure here costs
 * one image, not the question.
 */
export function ComposerAttachments({
  items,
  onRemove,
  disabled,
}: {
  items: ComposerAttachment[];
  onRemove: (localId: string) => void;
  disabled?: boolean;
}) {
  if (items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-3 pt-3">
      {items.map((item) => (
        <div key={item.localId} className="relative">
          {item.kind === "audio" ? (
            /*
              Playable while the question is still being edited, so a transcript
              that reads oddly can be checked against what was actually said. The
              caption is not decoration: a turn carries images only, so the clip
              contributes its words and is then dropped, and a player that looked
              like an attachment would promise otherwise.
            */
            <div
              className={cn(
                "flex h-16 flex-col justify-center gap-0.5 rounded-lg border px-2",
                item.status === "failed" && "border-destructive",
              )}
            >
              <div className="flex items-center gap-2">
                <audio
                  src={item.previewUrl}
                  controls
                  title={item.error ?? item.fileName}
                  className="h-8 w-56"
                />
                {item.status === "uploading" && (
                  <Spinner className="size-4 text-muted-foreground" />
                )}
                {item.status === "failed" && (
                  <AlertTriangle className="size-4 text-destructive" />
                )}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {item.status === "failed"
                  ? (item.error ?? "This recording could not be uploaded.")
                  : "Voice note — sent with its transcript"}
              </span>
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- an object URL
                  over the chosen file; there is nothing for the optimizer to fetch. */}
              <img
                src={item.previewUrl}
                alt={item.fileName}
                title={item.error ?? item.fileName}
                className={cn(
                  "size-16 rounded-lg border object-cover",
                  item.status !== "ready" && "opacity-60",
                  item.status === "failed" && "border-destructive",
                )}
              />

              {item.status === "uploading" && (
                <Spinner className="absolute inset-0 m-auto text-muted-foreground" />
              )}
              {item.status === "failed" && (
                <AlertTriangle className="absolute inset-0 m-auto size-4 text-destructive" />
              )}
            </>
          )}

          <Button
            type="button"
            variant="secondary"
            size="icon-xs"
            disabled={disabled}
            aria-label={`Remove ${item.fileName}`}
            onClick={() => onRemove(item.localId)}
            className="absolute -top-1.5 -right-1.5 size-5 rounded-full border shadow-xs"
          >
            <X className="size-3" />
          </Button>
        </div>
      ))}
    </div>
  );
}
