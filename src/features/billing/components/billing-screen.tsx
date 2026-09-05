"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ExternalLink, Gift, Zap } from "lucide-react";

import { DetailSection } from "@/components/detail-shell";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import { formatCredits, formatDate, formatDateTime, formatUsd } from "@/lib/format";
import { canAdminister } from "@/lib/workspace";
import { cn } from "@/lib/utils";
import {
  useBillingPortal,
  useBillingSummarySuspense,
  useCheckout,
  usePlanCatalogueSuspense,
  usePromoRedemptionsSuspense,
  useRedeemPromoCode,
  useTransactionsSuspense,
} from "../hooks/billing.hook";
import type { PlanOption } from "../service/billing.service";

function planPrice(plan: PlanOption): string {
  if (plan.price.monthlyUsd !== null) {
    return `${formatUsd(plan.price.monthlyUsd)}/mo`;
  }
  if (plan.price.perSeatUsd !== null) {
    return `${formatUsd(plan.price.perSeatUsd)}/seat/mo`;
  }
  return "Talk to us";
}

function planCredits(plan: PlanOption): string {
  if (plan.flatCredits !== null) {
    return `${formatCredits(plan.flatCredits)} credits a month`;
  }
  if (plan.creditsPerSeat !== null) {
    return `${formatCredits(plan.creditsPerSeat)} credits per seat a month`;
  }
  return "Credits by agreement";
}

export function BillingScreen() {
  const { workspace } = useWorkspace();
  const summary = useBillingSummarySuspense(workspace.id);
  const catalogue = usePlanCatalogueSuspense();
  const redemptions = usePromoRedemptionsSuspense(workspace.id);
  const checkout = useCheckout(workspace.id);
  const portal = useBillingPortal(workspace.id);
  const redeem = useRedeemPromoCode(workspace.id);

  const searchParams = useSearchParams();
  const checkoutResult = searchParams.get("checkout");
  const [code, setCode] = useState("");

  const mayPay = canAdminister(workspace.role);
  const current = summary.data.plan;

  return (
    <div className="space-y-6">
      {checkoutResult === "success" && (
        <Alert variant="info">
          <Check />
          <AlertTitle>Payment received</AlertTitle>
          <AlertDescription>
            Stripe confirms asynchronously, so the balance below updates once the
            webhook lands — usually within seconds.
          </AlertDescription>
        </Alert>
      )}
      {checkoutResult === "cancelled" && (
        <Alert>
          <AlertTitle>Checkout cancelled</AlertTitle>
          <AlertDescription>Nothing was charged.</AlertDescription>
        </Alert>
      )}

      <StatCardGrid>
        <StatCard
          label="Plan"
          value={<span className="capitalize">{current}</span>}
        />
        <StatCard
          label="Plan credits"
          value={formatCredits(summary.data.credits.plan)}
          hint={
            summary.data.credits.resetAt
              ? `Resets ${formatDate(summary.data.credits.resetAt)}`
              : "One-time grant — free plans are not refilled"
          }
        />
        <StatCard
          label="Top-up credits"
          value={formatCredits(summary.data.credits.topup)}
          hint="Never expire, spent after the plan bucket"
        />
        <StatCard
          label="Seats"
          value={`${summary.data.seats.used} / ${summary.data.seats.limit ?? "∞"}`}
        />
      </StatCardGrid>

      <DetailSection
        title="Plans"
        description="Credits are the unit of everything: one credit is one input token of the baseline model, and every model consumes them in proportion to what it costs."
        actions={
          <Button
            variant="outline"
            size="sm"
            disabled={!mayPay || portal.isPending}
            onClick={() => portal.mutate()}
          >
            <ExternalLink className="size-4" />
            Manage subscription
          </Button>
        }
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {catalogue.data.plans.map((plan) => {
            const isCurrent = plan.name === current;
            return (
              <div
                key={plan.name}
                className={cn(
                  "flex flex-col rounded-lg border p-4",
                  isCurrent && "border-primary ring-1 ring-primary/20",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-medium capitalize">{plan.name}</h3>
                  {isCurrent && <StatusBadge tone="info">current</StatusBadge>}
                </div>
                <p className="mt-1 text-lg font-semibold">{planPrice(plan)}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  {planCredits(plan)}
                </p>
                <ul className="mt-3 flex-1 space-y-1 text-xs text-muted-foreground">
                  <li>
                    {plan.seatLimit === null
                      ? "Unlimited seats"
                      : `Up to ${plan.seatLimit} seats`}
                  </li>
                  <li>
                    {plan.modelTiers.includes("premium")
                      ? "Economy and premium models"
                      : "Economy models"}
                  </li>
                  <li>
                    {plan.topupsEnabled
                      ? "Top-up packs available"
                      : "No top-ups"}
                  </li>
                </ul>
                <Button
                  className="mt-4"
                  size="sm"
                  variant={isCurrent ? "outline" : "default"}
                  disabled={
                    !mayPay ||
                    isCurrent ||
                    plan.stripePriceKey === null ||
                    checkout.isPending
                  }
                  onClick={() => checkout.mutate({ plan: plan.name })}
                >
                  {isCurrent
                    ? "Current plan"
                    : plan.stripePriceKey === null
                      ? "Contact sales"
                      : `Switch to ${plan.name}`}
                </Button>
              </div>
            );
          })}
        </div>
      </DetailSection>

      <DetailSection
        title="Top-up credits"
        description="One-off packs. They never expire and are spent only once the plan bucket is empty."
      >
        {summary.data.limits.topupsEnabled ? (
          <div className="grid gap-3 sm:grid-cols-3">
            {catalogue.data.topupPacks.map((pack) => (
              <div
                key={pack.id}
                className="flex items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div>
                  <p className="font-medium">{formatCredits(pack.credits)}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatUsd(pack.priceUsd)}
                    {pack.usdPerMillionCredits
                      ? ` · ${formatUsd(pack.usdPerMillionCredits)}/M`
                      : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!mayPay || checkout.isPending}
                  onClick={() => checkout.mutate({ pack: pack.id })}
                >
                  <Zap className="size-4" />
                  Buy
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            The {current} plan cannot buy top-ups. Upgrade first — a plan is
            cheaper per credit than a pack, which is the point.
          </p>
        )}
      </DetailSection>

      <DetailSection
        title="Promo code"
        description="Credits granted by a code land in the ledger like any other movement."
      >
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim()) {
              redeem.mutate(code.trim(), { onSuccess: () => setCode("") });
            }
          }}
        >
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="LAUNCH2026"
            disabled={!mayPay}
            className="max-w-xs uppercase"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={!mayPay || redeem.isPending || code.trim().length === 0}
          >
            <Gift className="size-4" />
            {redeem.isPending ? "Redeeming..." : "Redeem"}
          </Button>
        </form>

        {redemptions.data.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {redemptions.data.map((redemption) => (
              <Badge key={redemption.id} variant="secondary">
                {redemption.code} · {formatCredits(redemption.credits)} ·{" "}
                {formatDate(redemption.redeemedAt)}
              </Badge>
            ))}
          </div>
        )}
      </DetailSection>

      {mayPay && <TransactionsSection />}
    </div>
  );
}

/**
 * Split out and suspended on its own: the ledger is owner/admin only, so a
 * member never mounts this query at all — the backend would answer 403 and an
 * error card on an otherwise healthy page reads as a bug.
 */
function TransactionsSection() {
  const { workspace } = useWorkspace();
  const transactions = useTransactionsSuspense(workspace.id);

  return (
    <DetailSection
      title="Credit ledger"
      description="Every movement, in and out. The balance above is the sum of these rows — there is no separate total that can disagree with them."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Bucket</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="text-right">Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.data.items.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                Nothing has moved yet.
              </TableCell>
            </TableRow>
          )}
          {transactions.data.items.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                {formatDateTime(transaction.createdAt)}
              </TableCell>
              <TableCell className="text-xs">{transaction.kind}</TableCell>
              <TableCell className="text-xs">{transaction.bucket}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {transaction.source ?? "—"}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right text-xs tabular-nums",
                  transaction.amount < 0
                    ? "text-muted-foreground"
                    : "text-emerald-700 dark:text-emerald-400",
                )}
              >
                {transaction.amount > 0 ? "+" : ""}
                {formatCredits(Math.round(transaction.amount))}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DetailSection>
  );
}

export function BillingLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}

export function BillingError() {
  return (
    <p className="text-sm text-muted-foreground">Billing could not be loaded.</p>
  );
}
