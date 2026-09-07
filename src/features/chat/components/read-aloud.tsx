"use client";

import { Square, Volume2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkspaceId } from "@/features/workspace/components/workspace-provider";
import { useReadAloud } from "../hooks/speech.hook";

/**
 * Hear an answer instead of reading it.
 *
 * Absent, not disabled, on a deployment with no voice configured: the button
 * would be a permanent piece of furniture that never does anything, on every
 * answer in every thread.
 */
export function ReadAloudButton({ content }: { content: string }) {
  const workspaceId = useWorkspaceId();
  const { status, available, play, stop } = useReadAloud(workspaceId, content);

  if (!available || !content.trim()) return null;

  const label =
    status === "loading"
      ? "Generating audio…"
      : status === "playing"
        ? "Stop reading"
        : "Read this answer aloud";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          aria-label={label}
          // Generating is a cancellable wait, not a dead control: synthesis of a
          // page of prose takes seconds, and someone who changes their mind has
          // to be able to stop it.
          onClick={() => (status === "idle" ? void play() : stop())}
          className="text-muted-foreground"
        >
          {status === "loading" ? (
            <Spinner className="size-3.5" />
          ) : status === "playing" ? (
            <Square className="size-3" />
          ) : (
            <Volume2 className="size-3.5" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
