"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  useBillingSummarySuspense,
  usePlanCatalogueSuspense,
} from "@/features/billing/hooks/billing.hook";
import {
  GATED_PLAN_FEATURES,
  planUnlockingFeature,
} from "@/features/billing/service/billing.service";
import type { GatedPlanFeature } from "@/features/billing/service/billing.service";
import { useWorkspaceId } from "@/features/workspace/components/workspace-provider";

interface PlanGateProps {
  feature: GatedPlanFeature;
  /**
   * What the screen looks like, built from the components the real one is built
   * from and filled with invented rows. Rendered **instead of** `children` — an
   * overlay laid over the real thing is not a gate, because by then the rows it
   * covers have already been fetched.
   */
  preview: React.ReactNode;
  children: React.ReactNode;
}

/**
 * A locked replica of a screen this workspace's plan does not include.
 *
 * A signpost, not a lock: the backend answers 402 to every gated create whatever
 * this renders, and anybody can delete the overlay in devtools without gaining a
 * thing (CLAUDE.md #7). What it is really for is that `children` never mount, so
 * the data they would have loaded is never asked for. The page above must skip
 * the matching prefetch for the same reason — see `resolvePlanGate`.
 */
export function PlanGate({ feature, preview, children }: PlanGateProps) {
  const workspaceId = useWorkspaceId();
  const { data: billing } = useBillingSummarySuspense(workspaceId);
  const { data: catalogue } = usePlanCatalogueSuspense();

  if (billing.limits[feature]) return <>{children}</>;

  const upgrade = planUnlockingFeature(catalogue, feature);
  // Word for word what the backend's own refusal says, so a customer who hits
  // both never has to work out whether they are two different limits.
  const refusal =
    `${GATED_PLAN_FEATURES[feature]} are not included in the ${billing.plan} plan.` +
    (upgrade ? ` Upgrade to ${upgrade} to use them.` : "");

  return (
    <div className="relative isolate">
      {/* `inert` rather than a transparent sheet over the top: nothing in a
          replica should be reachable by pointer, keyboard or screen reader. */}
      <div inert className="select-none opacity-60 blur-[1.5px]">
        {preview}
      </div>

      <div className="absolute inset-0 flex items-start justify-center bg-background/50 p-4 md:p-8">
        <div className="max-w-md rounded-lg border bg-background p-6 text-center shadow-lg">
          <Lock className="mx-auto size-5 text-muted-foreground" />
          <p className="mt-3 text-sm font-medium">{refusal}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Anything this workspace already has keeps working — the plan limits what can
            be created, not what exists — so upgrading is also how you get back to
            revoking and removing it.
          </p>
          <Button asChild size="sm" className="mt-4">
            <Link href="/settings/billing">Plans and billing</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
