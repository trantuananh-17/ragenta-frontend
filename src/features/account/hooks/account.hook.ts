"use client";

import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

/**
 * Profile mutations stay with Better Auth rather than getting a REST twin —
 * duplicating them would mean two code paths writing the identity tables.
 */
export function useUpdateProfile() {
  const router = useRouter();

  return useMutation({
    mutationFn: async (input: { name: string }) => {
      const { error } = await authClient.updateUser({ name: input.name });
      if (error) throw new Error(error.message ?? "Could not save your profile.");
    },
    onSuccess: () => {
      toast.success("Profile updated.");
      // The name is rendered by the server-side shell, not by a query.
      router.refresh();
    },
    onError: (error: Error) => {
      toast.error("Not saved", { description: error.message });
    },
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: async (input: {
      currentPassword: string;
      newPassword: string;
    }) => {
      const { error } = await authClient.changePassword({
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        // Every other browser is signed out. A password change usually means
        // "someone else may have had it", and leaving those sessions alive
        // would defeat the point of changing it.
        revokeOtherSessions: true,
      });
      if (error) throw new Error(error.message ?? "Password change refused.");
    },
    onSuccess: () => {
      toast.success("Password changed", {
        description: "Every other session has been signed out.",
      });
    },
    onError: (error: Error) => {
      toast.error("Not changed", { description: error.message });
    },
  });
}
