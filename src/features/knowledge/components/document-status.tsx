"use client";

import { StatusBadge } from "@/components/status-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ACTIVE_DOCUMENT_STATUSES } from "../service/knowledge.service";

/**
 * The ingestion state machine as one badge: pending → parsing → chunking →
 * enriching → embedding → summarising → ready, or failed with a reason.
 *
 * The in-flight stages share a tone deliberately — what a reader needs is "still
 * working" versus "done" versus "broken", and colouring six intermediate stages
 * differently would only make the table flicker through a rainbow.
 */
const TONES = {
  ready: "success",
  failed: "danger",
  cancelled: "warning",
  pending: "neutral",
  parsing: "info",
  chunking: "info",
  enriching: "info",
  embedding: "info",
  summarising: "info",
} as const;

export function DocumentStatusBadge({
  status,
  error,
}: {
  status: string;
  error?: string | null;
}) {
  const tone = TONES[status as keyof typeof TONES] ?? "neutral";
  const badge = <StatusBadge tone={tone}>{status}</StatusBadge>;

  if (status !== "failed" || !error) return badge;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span>{badge}</span>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{error}</TooltipContent>
    </Tooltip>
  );
}

/**
 * How far along an ingestion is, and what it is doing.
 *
 * A percentage alone says nothing useful about a four-minute job — "Indexed 2 of
 * 6 parts" does. The bar exists so the shape of the wait is visible at a glance
 * and the message so the reason for it is readable; without them a large upload
 * is a spinner that lasts minutes, which is indistinguishable from a hang.
 */
export function DocumentProgress({
  status,
  progress,
  message,
  className,
}: {
  status: string;
  progress: number;
  message?: string | null;
  className?: string;
}) {
  if (!ACTIVE_DOCUMENT_STATUSES.includes(status)) return null;

  const percent = Math.round(Math.min(1, Math.max(0, progress)) * 100);

  return (
    <div className={cn("space-y-1", className)}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Indexing progress"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-500"
          style={{ width: `${percent}%` }}
        />
      </div>
      {message && (
        <p className="text-xs text-muted-foreground">
          {message}
          {percent > 0 && <span className="ml-1 tabular-nums">({percent}%)</span>}
        </p>
      )}
    </div>
  );
}
