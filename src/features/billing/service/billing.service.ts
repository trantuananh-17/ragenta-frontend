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

export const topupPackSchema = z.object({
  id: z.string(),
  credits: z.number(),
  priceUsd: z.number(),
  usdPerMillionCredits: z.number().optional(),
});

export const planCatalogueSchema = z.object({
  signupGrantCredits: z.number(),
  /** Defaulted so an older backend does not fail the whole price list. */
  freeMonthlyCredits: z.number().default(0),
  plans: z.array(
    z.object({
      name: z.string(),
      seatLimit: z.number().nullable(),
      creditsPerSeat: z.number().nullable(),
      flatCredits: z.number().nullable(),
      topupsEnabled: z.boolean(),
      modelTiers: z.array(z.string()),
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
});

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
export type AutoReload = z.infer<typeof autoReloadSchema>;
export type PromoRedemption = z.infer<typeof promoRedemptionSchema>;

export async function getBillingSummary(workspaceId: string) {
  const response = await api.get(`workspaces/${workspaceId}/billing`);
  return billingSummarySchema.parse(await response.json());
}

export async function getTransactions(workspaceId: string) {
  const response = await api.get(`workspaces/${workspaceId}/billing/transactions`, {
    searchParams: { limit: 50, offset: 0 },
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
 * Checkout. Exactly one of `plan` or `pack` — a subscription and a one-off
 * top-up use different Stripe modes, and the backend refuses both at once.
 *
 * A deployment with no Stripe keys refuses every payment route, which is why the
 * caller has to be ready to show that refusal rather than assume a URL.
 */
export async function createCheckout(
  workspaceId: string,
  input: { plan: string } | { pack: string },
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
