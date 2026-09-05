"use client";

import { StatusBadge } from "@/components/status-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * The ingestion state machine as one badge: pending → parsing → chunking →
 * embedding → ready, or failed with a reason.
 *
 * The in-flight stages share a tone deliberately — what a reader needs is "still
 * working" versus "done" versus "broken", and colouring four intermediate stages
 * differently would only make the table flicker through a rainbow.
 */
const TONES = {
  ready: "success",
  failed: "danger",
  pending: "neutral",
  parsing: "info",
  chunking: "info",
  embedding: "info",
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
