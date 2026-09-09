"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, ExternalLink, Gift, Zap } from "lucide-react";

import { DetailSection } from "@/components/detail-shell";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import { StatusBadge } from "@/components/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { cn } from "@/lib/utils";
import {
  useBillingPortal,
  useBillingSummarySuspense,
  useCheckout,
  usePlanCatalogueSuspense,
  usePromoRedemptionsSuspense,
  useRedeemPromoCode,
  usePaymentsSuspense,
  useTransactionsSuspense,
} from "../hooks/billing.hook";
import { creditsForUsd } from "../service/billing.service";
import type { BillingSummary } from "../service/billing.service";
import type { CustomTopupBounds, PlanOption } from "../service/billing.service";

function planPrice(plan: PlanOption): string {
  if (plan.price.monthlyUsd !== null) {
    return `${formatUsd(plan.price.monthlyUsd)}/mo`;
  }
  if (plan.price.perSeatUsd !== null) {
    return `${formatUsd(plan.price.perSeatUsd)}/seat/mo`;
  }
  return "Talk to us";
}

/**
 * What the plan grants, and how often.
 *
 * A plan with neither figure grants nothing on a schedule, and that is two
 * different situations: free is funded once by the signup grant and never again,
 * enterprise is whatever the contract says. Saying "a month" about either would
 * promise a refill that no job performs.
 */
function planCredits(plan: PlanOption, signupGrantCredits: number): string {
  if (plan.flatCredits !== null) {
    return `${formatCredits(plan.flatCredits)} credits a month`;
  }
  if (plan.creditsPerSeat !== null) {
    return `${formatCredits(plan.creditsPerSeat)} credits per seat a month`;
  }
  if (plan.price.monthlyUsd === 0) {
    return `${formatCredits(signupGrantCredits)} credits once, at signup`;
  }
  return "Credits by agreement";
}

/** A counted plan cap, in the noun a customer recognises. `null` is unlimited. */
function countLabel(limit: number | null, one: string, many: string): string {
  if (limit === null) return `Unlimited ${many}`;
  if (limit === 0) return `No ${many}`;
  return `${limit} ${limit === 1 ? one : many}`;
}

/**
 * What a typed amount buys, and what to say when it buys nothing yet.
 *
 * `credits: null` is what the Buy button reads to stay disabled, so the message
 * under the field and the refusal can never disagree — and the floor is stated
 * before it is reached, rather than by a checkout that refuses after the
 * redirect.
 */
function customTopupQuote(amount: string, bounds: CustomTopupBounds) {
  const dollars = Number(amount);

  if (amount.trim() === "" || !Number.isFinite(dollars)) {
    return {
      credits: null,
      hint: `${formatUsd(bounds.minUsd)} to ${formatUsd(bounds.maxUsd)}, at ${formatUsd(bounds.usdPerMillionCredits)} per million credits.`,
    };
  }
  if (!Number.isInteger(dollars)) {
    return { credits: null, hint: "Whole dollars only." };
  }
  if (dollars < bounds.minUsd) {
    return { credits: null, hint: `${formatUsd(bounds.minUsd)} minimum.` };
  }
  if (dollars > bounds.maxUsd) {
    return {
      credits: null,
      hint: `${formatUsd(bounds.maxUsd)} maximum — talk to us for anything larger.`,
    };
  }

  const credits = creditsForUsd(dollars, bounds.usdPerMillionCredits);
  return { credits, hint: `Buys ${formatCredits(credits)} credits.` };
}

export function BillingScreen() {
  const { workspace, can } = useWorkspace();
  const summary = useBillingSummarySuspense(workspace.id);
  const catalogue = usePlanCatalogueSuspense();
  const redemptions = usePromoRedemptionsSuspense(workspace.id);
  const checkout = useCheckout(workspace.id);
  const portal = useBillingPortal(workspace.id);
  const redeem = useRedeemPromoCode(workspace.id);

  const searchParams = useSearchParams();
  const checkoutResult = searchParams.get("checkout");
  const [code, setCode] = useState("");
  const [customAmount, setCustomAmount] = useState("");

  const mayPay = can("billing.manage");
  const current = summary.data.plan;
  const customTopup = catalogue.data.customTopup;
  const customQuote = customTopupQuote(customAmount, customTopup);

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

      <RenewalNotice subscription={summary.data.subscription} plan={current} />

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                  {planCredits(plan, catalogue.data.signupGrantCredits)}
                </p>
                <ul className="mt-3 flex-1 space-y-1 text-xs text-muted-foreground">
                  <li>
                    {plan.seatLimit === null
                      ? "Unlimited seats"
                      : `Up to ${plan.seatLimit} seats`}
                  </li>
                  <li>
                    {countLabel(
                      plan.knowledgeBaseLimit,
                      "knowledge base",
                      "knowledge bases",
                    )}
                  </li>
                  <li>{countLabel(plan.agentLimit, "agent", "agents")}</li>
                  <li>{countLabel(plan.widgetLimit, "widget", "widgets")}</li>
                  <li>
                    {plan.modelTiers.includes("premium")
                      ? "Economy and premium models"
                      : "Economy models"}
                  </li>
                  <li>
                    {plan.apiKeysEnabled ? "API keys" : "No API keys"}
                  </li>
                  <li>
                    {plan.dataSourcesEnabled
                      ? "External data sources"
                      : "No external data sources"}
                  </li>
                  <li>
                    {plan.automationEnabled
                      ? "Webhooks and triggers"
                      : "No webhooks or triggers"}
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
        description="One-off packs, or any amount you name. They never expire and are spent only once the plan bucket is empty."
      >
        {summary.data.limits.topupsEnabled ? (
          <>
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

            <form
              className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border p-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (customQuote.credits !== null) {
                  checkout.mutate({ amountUsd: Number(customAmount) });
                }
              }}
            >
              <div className="grid gap-2">
                <Label htmlFor="customTopupAmount">Or name an amount (USD)</Label>
                <Input
                  id="customTopupAmount"
                  type="number"
                  inputMode="numeric"
                  min={customTopup.minUsd}
                  max={customTopup.maxUsd}
                  step={1}
                  placeholder={String(customTopup.minUsd)}
                  value={customAmount}
                  onChange={(event) => setCustomAmount(event.target.value)}
                  disabled={!mayPay}
                  className="w-32"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={
                  !mayPay || checkout.isPending || customQuote.credits === null
                }
              >
                <Zap className="size-4" />
                Buy
              </Button>
              <p className="w-full text-xs text-muted-foreground">
                {customQuote.hint}
              </p>
            </form>
          </>
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
            {redeem.isPending && <Spinner data-icon="inline-start" />}
            Redeem
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

      {mayPay && <InvoicesSection />}
      {mayPay && <TransactionsSection />}
    </div>
  );
}

/**
 * Split out and suspended on its own: the ledger is owner/admin only, so a
 * member never mounts this query at all — the backend would answer 403 and an
 * error card on an otherwise healthy page reads as a bug.
 */
/**
 * When the plan renews, and whether it will.
 *
 * Stripe answered both of these from the first release and the API wrote them to
 * the subscription row, but nothing ever read them back out — so "when am I
 * charged next" and "did my cancellation take" had no answer anywhere in the
 * product. A cancelled subscription is the case worth being loud about: it keeps
 * working right up to a date, and the date is the only warning.
 */
function RenewalNotice({
  subscription,
  plan,
}: {
  subscription: BillingSummary["subscription"];
  plan: string;
}) {
  // A workspace that never went through checkout has no period to report, and a
  // card saying "renews: never" is worse than no card.
  if (!subscription?.periodEnd) return null;

  const ends = formatDate(subscription.periodEnd);
  const cancelling = subscription.cancelAtPeriodEnd;

  return (
    <Alert variant={cancelling ? "destructive" : "default"}>
      <AlertTitle>
        {cancelling ? `Cancels on ${ends}` : `Renews on ${ends}`}
      </AlertTitle>
      <AlertDescription>
        {cancelling ? (
          <>
            The <span className="capitalize">{plan}</span> plan stays active until
            then, and the workspace drops to free afterwards. Reopen the payment
            portal to keep it.
          </>
        ) : (
          <>
            The <span className="capitalize">{plan}</span> plan renews automatically
            {subscription.seats ? ` for ${subscription.seats} seat${subscription.seats === 1 ? "" : "s"}` : ""}
            . Manage the card or cancel in the payment portal.
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * What was actually paid, separate from the credit ledger below it.
 *
 * A payment and a credit movement are different facts in different units, and a
 * single table carrying both would have an "amount" column meaning dollars on one
 * row and credits on the next.
 */
function InvoicesSection() {
  const { workspace } = useWorkspace();
  const [page, setPage] = useState(0);
  const payments = usePaymentsSuspense(workspace.id, page);

  const { items, total, limit, offset } = payments.data;
  const lastPage = Math.max(0, Math.ceil(total / limit) - 1);

  return (
    <DetailSection
      title="Invoices"
      description="Every charge, successful or not. A failed one is kept because it is the reason a plan is about to lapse."
      actions={
        total > limit ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              {offset + 1}–{offset + items.length} of {total}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Newer invoices"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Older invoices"
              disabled={page >= lastPage}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : undefined
      }
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Period</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="w-0" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={6}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                Nothing has been charged yet.
              </TableCell>
            </TableRow>
          )}
          {items.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                {formatDate(payment.createdAt)}
              </TableCell>
              <TableCell className="text-sm">{payment.description}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {payment.periodStart && payment.periodEnd
                  ? `${formatDate(payment.periodStart)} — ${formatDate(payment.periodEnd)}`
                  : "—"}
              </TableCell>
              <TableCell>
                <StatusBadge
                  tone={
                    payment.status === "paid"
                      ? "success"
                      : payment.status === "failed"
                        ? "danger"
                        : "neutral"
                  }
                >
                  {payment.status}
                </StatusBadge>
              </TableCell>
              <TableCell className="text-right text-sm tabular-nums">
                {formatUsd(payment.amountUsd)}
              </TableCell>
              <TableCell className="text-right">
                {payment.hostedInvoiceUrl && (
                  <Button variant="ghost" size="sm" asChild>
                    <a
                      href={payment.hostedInvoiceUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <ExternalLink className="size-4" />
                      Receipt
                    </a>
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </DetailSection>
  );
}

function TransactionsSection() {
  const { workspace } = useWorkspace();
  const [page, setPage] = useState(0);
  const transactions = useTransactionsSuspense(workspace.id, page);

  const { items, total, limit, offset } = transactions.data;
  const lastPage = Math.max(0, Math.ceil(total / limit) - 1);

  return (
    <DetailSection
      title="Credit ledger"
      description="Every movement, in and out. The balance above is the sum of these rows — there is no separate total that can disagree with them."
      actions={
        total > limit ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground tabular-nums">
              {offset + 1}–{offset + items.length} of {total}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Newer movements"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Older movements"
              disabled={page >= lastPage}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        ) : undefined
      }
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
          {items.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={5}
                className="py-10 text-center text-sm text-muted-foreground"
              >
                Nothing has moved yet.
              </TableCell>
            </TableRow>
          )}
          {items.map((transaction) => (
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
                    : "text-success",
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
