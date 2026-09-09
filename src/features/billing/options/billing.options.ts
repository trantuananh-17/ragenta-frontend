import { queryOptions } from "@tanstack/react-query";

import {
  getAutoReload,
  getBillingSummary,
  getPayments,
  getPlanCatalogue,
  getPromoRedemptions,
  getTransactions,
} from "../service/billing.service";

export const billingKeys = {
  all: () => ["billing"] as const,
  summary: (workspaceId: string) =>
    [...billingKeys.all(), "summary", workspaceId] as const,
  transactions: (workspaceId: string, page: number) =>
    [...billingKeys.all(), "transactions", workspaceId, page] as const,
  payments: (workspaceId: string, page: number) =>
    [...billingKeys.all(), "payments", workspaceId, page] as const,
  plans: () => [...billingKeys.all(), "plans"] as const,
  autoReload: (workspaceId: string) =>
    [...billingKeys.all(), "auto-reload", workspaceId] as const,
  promos: (workspaceId: string) =>
    [...billingKeys.all(), "promos", workspaceId] as const,
};

export const billingOptions = {
  summary: (workspaceId: string) =>
    queryOptions({
      queryKey: billingKeys.summary(workspaceId),
      queryFn: () => getBillingSummary(workspaceId),
    }),
  transactions: (workspaceId: string, page: number) =>
    queryOptions({
      queryKey: billingKeys.transactions(workspaceId, page),
      queryFn: () => getTransactions(workspaceId, page),
      // The previous page stays on screen while the next one loads, so paging
      // does not blank the table it is paging.
      placeholderData: (previous) => previous,
    }),
  payments: (workspaceId: string, page: number) =>
    queryOptions({
      queryKey: billingKeys.payments(workspaceId, page),
      queryFn: () => getPayments(workspaceId, page),
      placeholderData: (previous) => previous,
    }),
  plans: () =>
    queryOptions({
      queryKey: billingKeys.plans(),
      queryFn: getPlanCatalogue,
      // The price list is served from server constants; it moves on a deploy.
      staleTime: 10 * 60 * 1000,
    }),
  autoReload: (workspaceId: string) =>
    queryOptions({
      queryKey: billingKeys.autoReload(workspaceId),
      queryFn: () => getAutoReload(workspaceId),
    }),
  promos: (workspaceId: string) =>
    queryOptions({
      queryKey: billingKeys.promos(workspaceId),
      queryFn: () => getPromoRedemptions(workspaceId),
    }),
};
