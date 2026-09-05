"use client";

import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { toast } from "sonner";

import { errorMessage } from "@/lib/api-error";
import { formatCredits } from "@/lib/format";
import { workspaceKeys } from "@/features/workspace/options/workspace.options";
import { billingKeys, billingOptions } from "../options/billing.options";
import {
  createCheckout,
  createPortalSession,
  redeemPromoCode,
  updateAutoReload,
} from "../service/billing.service";

export function useBillingSummarySuspense(workspaceId: string) {
  return useSuspenseQuery(billingOptions.summary(workspaceId));
}

/** Non-suspending: the sidebar shows the balance but must never block on it. */
export function useBillingSummary(workspaceId: string) {
  return useQuery(billingOptions.summary(workspaceId));
}

export function useTransactionsSuspense(workspaceId: string) {
  return useSuspenseQuery(billingOptions.transactions(workspaceId));
}

export function usePlanCatalogueSuspense() {
  return useSuspenseQuery(billingOptions.plans());
}

export function useAutoReloadSuspense(workspaceId: string) {
  return useSuspenseQuery(billingOptions.autoReload(workspaceId));
}

export function usePromoRedemptionsSuspense(workspaceId: string) {
  return useSuspenseQuery(billingOptions.promos(workspaceId));
}

/**
 * Checkout hands the browser straight to Stripe. `window.location.assign` rather
 * than a new tab: a payment flow that returns to a background tab loses the
 * user, and the success URL comes back to this app anyway.
 */
export function useCheckout(workspaceId: string) {
  return useMutation({
    mutationFn: (input: { plan: string } | { pack: string }) =>
      createCheckout(workspaceId, input),
    onSuccess: ({ url }) => {
      if (url) window.location.assign(url);
      else
        toast.error("Checkout unavailable", {
          description: "Stripe returned no session URL.",
        });
    },
    onError: async (error) => {
      toast.error("Checkout refused", {
        description: await errorMessage(error),
      });
    },
  });
}

export function useBillingPortal(workspaceId: string) {
  return useMutation({
    mutationFn: () => createPortalSession(workspaceId),
    onSuccess: ({ url }) => {
      if (url) window.location.assign(url);
    },
    onError: async (error) => {
      toast.error("Billing portal unavailable", {
        description: await errorMessage(error),
      });
    },
  });
}

export function useUpdateAutoReload(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: {
      enabled: boolean;
      thresholdCredits?: number;
      pack?: string;
    }) => updateAutoReload(workspaceId, input),
    onSuccess: (_result, input) => {
      toast.success(input.enabled ? "Auto-reload on." : "Auto-reload off.");
      queryClient.invalidateQueries({
        queryKey: billingKeys.autoReload(workspaceId),
      });
    },
    onError: async (error) => {
      toast.error("Change refused", { description: await errorMessage(error) });
    },
  });
}

export function useRedeemPromoCode(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (code: string) => redeemPromoCode(workspaceId, code),
    onSuccess: (result) => {
      toast.success(`${formatCredits(result.credits)} credits added`, {
        description: `Code ${result.code} redeemed into the ${result.bucket} bucket.`,
      });
      queryClient.invalidateQueries({ queryKey: billingKeys.all() });
      queryClient.invalidateQueries({
        queryKey: workspaceKeys.overview(workspaceId),
      });
    },
    onError: async (error) => {
      toast.error("Code refused", { description: await errorMessage(error) });
    },
  });
}
