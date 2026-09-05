"use client";

import Link from "next/link";
import { Coins } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useWorkspaceId } from "@/features/workspace/components/workspace-provider";
import { formatCredits } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useBillingSummary } from "../hooks/billing.hook";

/**
 * Refusing a turn below this is the backend's rule, not a display choice — it
 * declines rather than dying mid-stream. Warning at the same number is what makes
 * the refusal, when it comes, not a surprise.
 */
const LOW_BALANCE = 5_000;

export function CreditsIndicator() {
  const workspaceId = useWorkspaceId();
  const { data } = useBillingSummary(workspaceId);

  if (!data) return null;

  const total = data.credits.total;
  const low = total < LOW_BALANCE;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          asChild
          variant="ghost"
          size="sm"
          className={cn("gap-1.5 tabular-nums", low && "text-destructive")}
        >
          <Link href="/settings/billing">
            <Coins className="size-4" />
            {formatCredits(total)}
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {low
          ? "Too low for another answer — top up to keep chatting."
          : `${formatCredits(data.credits.plan)} plan + ${formatCredits(data.credits.topup)} top-up, on the ${data.plan} plan.`}
      </TooltipContent>
    </Tooltip>
  );
}
