import { z } from "zod";

import { api } from "@/lib/ky";
import { pageSchema } from "@/lib/pagination";
import { billingSummarySchema } from "@/features/workspace/service/workspace.service";

export { billingSummarySchema };
export type { BillingSummary } from "@/features/workspace/service/workspace.service";

/**
 * One movement of credit. Positive adds, negative spends; `bucket` says which
 * balance moved and `source` what consumed it. The ledger is the balance — there
 * is no mutable total anywhere to disagree with it (ADR-008).
 */
export const creditTransactionSchema = z.object({
  id: z.string(),
  kind: z.string(),
  bucket: z.string(),
  amount: z.coerce.number(),
  reference: z.string(),
  source: z.string().nullable(),
  createdAt: z.coerce.string(),
});

export const transactionsPageSchema = pageSchema(creditTransactionSchema);

/**
 * A payment, which is not a credit movement.
 *
 * The ledger says what may be spent; this says what was paid for it. Keeping
 * them in separate tables and separate screens is what stops one "amount" column
 * meaning credits on one row and dollars on the next.
 */
export const paymentSchema = z.object({
  id: z.string(),
  kind: z.string(),
  status: z.string(),
  amountUsd: z.coerce.number(),
  currency: z.string(),
  description: z.string(),
  hostedInvoiceUrl: z.string().nullable(),
  invoicePdfUrl: z.string().nullable(),
  periodStart: z.coerce.string().nullable(),
  periodEnd: z.coerce.string().nullable(),
  createdAt: z.coerce.string(),
});

export const paymentsPageSchema = pageSchema(paymentSchema);

export type Payment = z.infer<typeof paymentSchema>;

export const PAYMENTS_PAGE_SIZE = 20;

export async function getPayments(workspaceId: string, page: number) {
  const response = await api.get(`workspaces/${workspaceId}/billing/payments`, {
    searchParams: { limit: PAYMENTS_PAGE_SIZE, offset: page * PAYMENTS_PAGE_SIZE },
  });
  return paymentsPageSchema.parse(await response.json());
}

export const topupPackSchema = z.object({
  id: z.string(),
  credits: z.number(),
  priceUsd: z.number(),
  usdPerMillionCredits: z.number().optional(),
});

/**
 * The bounds of a custom top-up, read from the server rather than repeated here
 * — the checkout enforces these numbers, and a screen quoting a different rate
 * would promise credits the payment does not buy.
 *
 * Defaulted so an older backend does not fail the whole price list.
 */
export const customTopupSchema = z.object({
  minUsd: z.number(),
  maxUsd: z.number(),
  usdPerMillionCredits: z.number(),
});

/**
 * The price list.
 *
 * `freeMonthlyCredits` is deliberately absent: free carries no allowance at all
 * any more, so the server sends a permanent 0 that nothing here may quote.
 * `signupGrantCredits` is the whole of the free tier and the only honest number
 * to show for it.
 */
export const planCatalogueSchema = z.object({
  signupGrantCredits: z.number(),
  plans: z.array(
    z.object({
      name: z.string(),
      seatLimit: z.number().nullable(),
      creditsPerSeat: z.number().nullable(),
      flatCredits: z.number().nullable(),
      topupsEnabled: z.boolean(),
      modelTiers: z.array(z.string()),
      /**
       * What the plan unlocks beyond credits. Defaulted so an older backend does
       * not fail the whole price list — and defaulted to *ungated*, because an
       * API that does not send these fields is one that does not enforce them,
       * so "unlimited" and "included" are what it actually does.
       */
      widgetLimit: z.number().nullable().default(null),
      knowledgeBaseLimit: z.number().nullable().default(null),
      agentLimit: z.number().nullable().default(null),
      apiKeysEnabled: z.boolean().default(true),
      dataSourcesEnabled: z.boolean().default(true),
      automationEnabled: z.boolean().default(true),
      price: z.object({
        monthlyUsd: z.number().nullable(),
        perSeatUsd: z.number().nullable(),
        includedSeats: z.number().nullable(),
        extraSeatUsd: z.number().nullable(),
      }),
      stripePriceKey: z.string().nullable(),
    }),
  ),
  topupPacks: z.array(topupPackSchema),
  customTopup: customTopupSchema.default({
    minUsd: 10,
    maxUsd: 2000,
    usdPerMillionCredits: 39,
  }),
});

/**
 * What a dollar amount buys, quoted the way the server grants it: rounded down,
 * because a credit is a whole unit and the checkout will not grant a fraction.
 */
export function creditsForUsd(
  amountUsd: number,
  usdPerMillionCredits: number,
): number {
  return Math.floor((amountUsd * 1_000_000) / usdPerMillionCredits);
}

export const autoReloadSchema = z.object({
  enabled: z.boolean(),
  thresholdCredits: z.number().nullable(),
  pack: z.string().nullable(),
  lastFailureCode: z.string().nullable(),
  lastFailureAt: z.coerce.string().nullable(),
  availablePacks: z.array(topupPackSchema),
});

export const promoRedemptionSchema = z.object({
  id: z.string(),
  code: z.string(),
  credits: z.number(),
  redeemedAt: z.coerce.string(),
});

export type CreditTransaction = z.infer<typeof creditTransactionSchema>;
export type PlanCatalogue = z.infer<typeof planCatalogueSchema>;
export type PlanOption = PlanCatalogue["plans"][number];
export type TopupPack = z.infer<typeof topupPackSchema>;
export type CustomTopupBounds = z.infer<typeof customTopupSchema>;
export type AutoReload = z.infer<typeof autoReloadSchema>;
export type PromoRedemption = z.infer<typeof promoRedemptionSchema>;

export type CheckoutInput =
  | { plan: string }
  | { pack: string }
  | { amountUsd: number };

export async function getBillingSummary(workspaceId: string) {
  const response = await api.get(`workspaces/${workspaceId}/billing`);
  return billingSummarySchema.parse(await response.json());
}

/**
 * The credit ledger, a page at a time.
 *
 * It used to ask for the first fifty and stop, which read as "this is all that
 * ever happened" — a workspace that has been running for a month has thousands
 * of rows, and the fifty-first was unreachable rather than merely off screen.
 */
export const LEDGER_PAGE_SIZE = 50;

export async function getTransactions(workspaceId: string, page: number) {
  const response = await api.get(`workspaces/${workspaceId}/billing/transactions`, {
    searchParams: { limit: LEDGER_PAGE_SIZE, offset: page * LEDGER_PAGE_SIZE },
  });
  return transactionsPageSchema.parse(await response.json());
}

export async function getPlanCatalogue(): Promise<PlanCatalogue> {
  const response = await api.get("plans");
  return planCatalogueSchema.parse(await response.json());
}

export async function getAutoReload(workspaceId: string): Promise<AutoReload> {
  const response = await api.get(`workspaces/${workspaceId}/billing/auto-reload`);
  return autoReloadSchema.parse(await response.json());
}

export async function updateAutoReload(
  workspaceId: string,
  input: { enabled: boolean; thresholdCredits?: number; pack?: string },
): Promise<void> {
  await api.put(`workspaces/${workspaceId}/billing/auto-reload`, { json: input });
}

/**
 * Checkout. Exactly one of `plan`, `pack` or `amountUsd` — a subscription and a
 * one-off top-up use different Stripe modes, and the backend refuses more than
 * one at once.
 *
 * A deployment with no Stripe keys refuses every payment route, which is why the
 * caller has to be ready to show that refusal rather than assume a URL.
 */
export async function createCheckout(
  workspaceId: string,
  input: CheckoutInput,
): Promise<{ url: string | null }> {
  const response = await api.post(`workspaces/${workspaceId}/billing/checkout`, {
    json: input,
  });
  return z
    .object({ url: z.string().nullable(), sessionId: z.string().optional() })
    .parse(await response.json());
}

export async function createPortalSession(
  workspaceId: string,
): Promise<{ url: string | null }> {
  const response = await api.post(`workspaces/${workspaceId}/billing/portal`);
  return z.object({ url: z.string().nullable() }).parse(await response.json());
}

export async function getPromoRedemptions(
  workspaceId: string,
): Promise<PromoRedemption[]> {
  const response = await api.get(`workspaces/${workspaceId}/billing/promo-codes`);
  return z
    .object({ items: z.array(promoRedemptionSchema) })
    .parse(await response.json()).items;
}

export async function redeemPromoCode(
  workspaceId: string,
  code: string,
): Promise<{ code: string; credits: number; bucket: string }> {
  const response = await api.post(
    `workspaces/${workspaceId}/billing/promo-codes/redeem`,
    { json: { code } },
  );
  return z
    .object({ code: z.string(), credits: z.number(), bucket: z.string() })
    .parse(await response.json());
}
