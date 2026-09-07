"use client";

import { CheckCircle2, CircleAlert, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import type { GraphProblem } from "./graph-validation";

/**
 * What is wrong with the flow, before Publish rather than after a failed run.
 *
 * Each line selects the step it is about, because the fix is always in that
 * step's settings and hunting for it on the canvas is the slow part.
 */
export function ValidationPanel({
  problems,
  onSelect,
}: {
  problems: GraphProblem[];
  onSelect: (nodeId: string) => void;
}) {
  const blocking = problems.filter((problem) => problem.blocksPublish).length;

  return (
    <div className="space-y-2 rounded-lg border p-3">
      <Label className="text-xs">
        Checks{" "}
        {blocking > 0 && (
          <span className="text-destructive tabular-nums">
            {blocking} blocking publish
          </span>
        )}
      </Label>

      {problems.length === 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3.5 text-emerald-600" />
          Nothing to fix.
        </p>
      ) : (
        <ul className="space-y-1">
          {problems.map((problem, index) => {
            const Icon = problem.level === "error" ? CircleAlert : TriangleAlert;
            return (
              <li key={index}>
                <button
                  type="button"
                  disabled={!problem.nodeId}
                  onClick={() => problem.nodeId && onSelect(problem.nodeId)}
                  className={cn(
                    "flex w-full items-start gap-1.5 rounded-md px-1.5 py-1 text-left text-[11px] leading-snug",
                    problem.nodeId && "hover:bg-muted",
                  )}
                >
                  <Icon
                    className={cn(
                      "mt-px size-3.5 shrink-0",
                      problem.level === "error" ? "text-destructive" : "text-amber-600",
                    )}
                  />
                  <span>{problem.message}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
