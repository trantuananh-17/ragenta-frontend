"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

export const authKeys = {
  all: () => ["auth"] as const,
  session: () => [...authKeys.all(), "session"] as const,
};

export interface Credentials {
  email: string;
  password: string;
}

/**
 * Where to land after signing in. `redirect` is only honoured when it is a path
 * on this origin — an absolute URL there would be an open redirect.
 */
function safeRedirect(value: string | null, fallback: string): string {
  if (!value) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  return value;
}

/**
 * Where the link in a verification email comes back to. The sign-in page, not a
 * page inside the app: verifying signs the account in, and `requireUnAuth` there
 * forwards a live session onwards — while a link that expired arrives with
 * `?error=` and lands somewhere that can offer a fresh one.
 */
function verificationCallbackUrl(): string {
  return `${window.location.origin}/login`;
}

/**
 * Sign-in answers 403 when the password was *correct* but the address has not
 * been confirmed yet — `requireEmailVerification` in `ragenta-backend`. It is
 * carried as its own type so the form can offer a new link instead of telling
 * the person their password was wrong.
 */
export class EmailNotVerifiedError extends Error {
  constructor(readonly email: string) {
    super("Email not verified.");
    this.name = "EmailNotVerifiedError";
  }
}

export function useLogin(redirectTo: string | null) {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ email, password }: Credentials) => {
      const { data, error } = await authClient.signIn.email({ email, password });
      if (error?.code === "EMAIL_NOT_VERIFIED") throw new EmailNotVerifiedError(email);
      if (error) throw new Error(error.message ?? "Sign in failed.");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: authKeys.session() });
      // `refresh` re-runs the server gate, which is what decides whether this
      // account has a workspace yet or needs onboarding.
      router.push(safeRedirect(redirectTo, "/chat"));
      router.refresh();
    },
    onError: (error: Error) => {
      // The unverified case is shown inline instead, next to the way out of it.
      if (error instanceof EmailNotVerifiedError) return;
      toast.error("Sign in failed", { description: error.message });
    },
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: async ({
      name,
      email,
      password,
    }: Credentials & { name: string }) => {
      const { data, error } = await authClient.signUp.email({
        name,
        email,
        password,
        callbackURL: verificationCallbackUrl(),
      });
      if (error) throw new Error(error.message ?? "Sign up failed.");
      return data;
    },
    // Deliberately no redirect and no session invalidation: sign-up no longer
    // returns a session, and a 200 does not even mean the account is new — an
    // address that already exists gets the same answer. The form says so.
    onError: (error: Error) => {
      toast.error("Sign up failed", { description: error.message });
    },
  });
}

export function useResendVerificationEmail() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await authClient.sendVerificationEmail({
        email,
        callbackURL: verificationCallbackUrl(),
      });
      if (error) throw new Error(error.message ?? "Could not send the email.");
    },
    onSuccess: () => {
      // The endpoint answers the same for every address, so the wording cannot
      // imply that one has an account or still needs verifying.
      toast.success("Check your inbox", {
        description: "If that address still needs verifying, a new link is on its way.",
      });
    },
    onError: (error: Error) => {
      toast.error("Request failed", { description: error.message });
    },
  });
}

export function useGoogleSignIn(redirectTo: string | null) {
  return useMutation({
    mutationFn: async () => {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: `${window.location.origin}${safeRedirect(redirectTo, "/chat")}`,
      });
    },
    onError: (error: Error) => {
      toast.error("Google sign-in failed", { description: error.message });
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await authClient.signOut();
    },
    onSuccess: () => {
      // Everything cached was fetched as this user, in one workspace. Clear it
      // before the next person signs in on the same browser.
      queryClient.clear();
      router.push("/login");
      router.refresh();
    },
    onError: () => {
      toast.error("Sign out failed", { description: "Please try again." });
    },
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw new Error(error.message ?? "Could not send the email.");
    },
    onSuccess: () => {
      // Deliberately does not say whether the address exists.
      toast.success("Check your inbox", {
        description: "If that address has an account, a reset link is on its way.",
      });
    },
    onError: (error: Error) => {
      toast.error("Request failed", { description: error.message });
    },
  });
}

export function useResetPassword() {
  const router = useRouter();

  return useMutation({
    mutationFn: async ({
      token,
      newPassword,
    }: {
      token: string;
      newPassword: string;
    }) => {
      const { error } = await authClient.resetPassword({ token, newPassword });
      if (error) throw new Error(error.message ?? "Password reset failed.");
    },
    onSuccess: () => {
      toast.success("Password updated", { description: "Sign in with it now." });
      router.push("/login");
    },
    onError: (error: Error) => {
      toast.error("Reset failed", { description: error.message });
    },
  });
}

export function useAcceptInvitation() {
  const router = useRouter();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { data, error } = await authClient.organization.acceptInvitation({
        invitationId,
      });
      if (error) throw new Error(error.message ?? "Invitation could not be accepted.");
      return data;
    },
    onSuccess: () => {
      toast.success("You're in.");
      queryClient.clear();
      router.push("/chat");
      router.refresh();
    },
    onError: (error: Error) => {
      toast.error("Invitation refused", { description: error.message });
    },
  });
}
