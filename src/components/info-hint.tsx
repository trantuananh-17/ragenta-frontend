"use client";

import { Info } from "lucide-react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * The long explanation, behind an icon.
 *
 * This console describes what a setting does *to customers* — narrowing a plan's
 * models moves every workspace on it, an embedding choice is frozen at creation
 * — and none of that is guessable from a label. Printed in full it turned an
 * operator screen into a document: three paragraphs of prose above every control
 * an operator has already read once and now has to scroll past.
 *
 * So the text stays, and moves one hover away. Rendered as a real button, not a
 * bare icon, so it is reachable by keyboard — a tooltip that only answers to a
 * mouse hides the explanation from the people most likely to need it.
 */
export function InfoHint({
  children,
  label = "More information",
}: {
  children: React.ReactNode;
  label?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex size-4 shrink-0 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        className="max-w-xs text-xs leading-relaxed font-normal"
      >
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
