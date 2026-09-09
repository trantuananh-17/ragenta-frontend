"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { AlertCircle } from "lucide-react";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  EmailNotVerifiedError,
  useGoogleSignIn,
  useLogin,
  useRequestPasswordReset,
  useResendVerificationEmail,
  useResetPassword,
  useSignUp,
} from "../hooks/auth.hook";

/**
 * The separator's label sits on a `Card`, and `FieldSeparator` paints its label
 * `bg-background` — the same colour in light mode but two steps lighter in dark,
 * which would show as a band across the rule.
 */
const ON_CARD = "*:data-[slot=field-separator-content]:bg-card";

const loginSchema = z.object({
  email: z.email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password."),
});

export function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  // A verification link that no longer works comes back here carrying `error`;
  // a working one signs the account in and never reaches this form.
  const verificationLinkFailed = searchParams.has("error");
  const login = useLogin(redirectTo);
  const googleSignIn = useGoogleSignIn(redirectTo);
  const resendVerification = useResendVerificationEmail();

  const unverified =
    login.error instanceof EmailNotVerifiedError ? login.error : null;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const pending = login.isPending || googleSignIn.isPending;

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to your Ragenta workspace</CardDescription>
      </CardHeader>
      <CardContent>
        {verificationLinkFailed && !unverified && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle />
            <AlertDescription>
              That verification link did not work — it may have expired or been
              used already. Sign in below and we will offer you a new one.
            </AlertDescription>
          </Alert>
        )}

        {unverified && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle />
            <AlertDescription className="grid justify-items-start gap-2">
              <span>
                Confirm {unverified.email} before signing in — the link is in
                the message we sent when the account was created.
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={resendVerification.isPending}
                onClick={() => resendVerification.mutate(unverified.email)}
              >
                {resendVerification.isPending && (
                  <Spinner data-icon="inline-start" />
                )}
                Send a new verification link
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit((values) => login.mutate(values))}>
          <FieldGroup>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={() => googleSignIn.mutate()}
            >
              {googleSignIn.isPending && <Spinner data-icon="inline-start" />}
              Continue with Google
            </Button>

            <FieldSeparator className={ON_CARD}>
              Or continue with email
            </FieldSeparator>

            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...register("email")}
              />
              <FieldError id="email-error" errors={[errors.email]} />
            </Field>

            <Field data-invalid={errors.password ? true : undefined}>
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Link
                  href="/forgot-password"
                  className="rounded-sm text-xs text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
                {...register("password")}
              />
              <FieldError id="password-error" errors={[errors.password]} />
            </Field>

            <Button type="submit" className="w-full" disabled={pending}>
              {login.isPending && <Spinner data-icon="inline-start" />}
              Sign in
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              No account yet?{" "}
              <Link
                href="/signup"
                className="rounded-sm text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                Create one
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

const signUpSchema = z.object({
  name: z.string().trim().min(2, "Tell us what to call you."),
  email: z.email("Enter a valid email address."),
  password: z
    .string()
    .min(8, "At least 8 characters.")
    .max(128, "That is longer than the server accepts."),
});

export function SignUpForm() {
  const signUp = useSignUp();
  const googleSignIn = useGoogleSignIn(null);

  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors },
  } = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { name: "", email: "", password: "" },
  });

  const pending = signUp.isPending || googleSignIn.isPending;

  // Sign-up answers the same way for a new address and for one that already has
  // an account, and it hands back no session either way — so this can neither
  // claim an account was created nor send anyone into the app.
  if (signUp.isSuccess) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>Check your email</CardTitle>
          <CardDescription>
            If {getValues("email")} still needs verifying, a link is on its way.
            Open it to finish setting up your Ragenta account — signing in only
            works once the address is confirmed.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link
            href="/login"
            className="rounded-sm text-sm text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Back to sign in
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Every new workspace starts with free credits — no card needed.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((values) => signUp.mutate(values))}>
          <FieldGroup>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={pending}
              onClick={() => googleSignIn.mutate()}
            >
              {googleSignIn.isPending && <Spinner data-icon="inline-start" />}
              Continue with Google
            </Button>

            <FieldSeparator className={ON_CARD}>
              Or continue with email
            </FieldSeparator>

            <Field data-invalid={errors.name ? true : undefined}>
              <FieldLabel htmlFor="name">Name</FieldLabel>
              <Input
                id="name"
                autoComplete="name"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? "name-error" : undefined}
                {...register("name")}
              />
              <FieldError id="name-error" errors={[errors.name]} />
            </Field>

            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...register("email")}
              />
              <FieldError id="email-error" errors={[errors.email]} />
            </Field>

            <Field data-invalid={errors.password ? true : undefined}>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!errors.password}
                aria-describedby={errors.password ? "password-error" : undefined}
                {...register("password")}
              />
              <FieldError id="password-error" errors={[errors.password]} />
            </Field>

            <Button type="submit" className="w-full" disabled={pending}>
              {signUp.isPending && <Spinner data-icon="inline-start" />}
              Create account
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link
                href="/login"
                className="rounded-sm text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                Sign in
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

const forgotSchema = z.object({ email: z.email("Enter a valid email address.") });

export function ForgotPasswordForm() {
  const request = useRequestPasswordReset();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof forgotSchema>>({
    resolver: zodResolver(forgotSchema),
    defaultValues: { email: "" },
  });

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Reset your password</CardTitle>
        <CardDescription>
          We will email a link to the address on your account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit((values) => request.mutate(values.email))}>
          <FieldGroup>
            <Field data-invalid={errors.email ? true : undefined}>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? "email-error" : undefined}
                {...register("email")}
              />
              <FieldError id="email-error" errors={[errors.email]} />
            </Field>

            <Button
              type="submit"
              className="w-full"
              disabled={request.isPending}
            >
              {request.isPending && <Spinner data-icon="inline-start" />}
              Send reset link
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link
                href="/login"
                className="rounded-sm text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                Back to sign in
              </Link>
            </p>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}

const resetSchema = z
  .object({
    newPassword: z.string().min(8, "At least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    message: "The two passwords do not match.",
    path: ["confirmPassword"],
  });

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const reset = useResetPassword();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<z.infer<typeof resetSchema>>({
    resolver: zodResolver(resetSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });

  if (!token) {
    return (
      <Card>
        <CardHeader className="text-center">
          <CardTitle>This link is incomplete</CardTitle>
          <CardDescription>
            It carries no reset token. Request a new one and use the newest email.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <Link
            href="/forgot-password"
            className="rounded-sm text-sm text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            Request a new link
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Choose a new password</CardTitle>
        <CardDescription>
          Signing in again afterwards keeps every other session out.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={handleSubmit((values) =>
            reset.mutate({ token, newPassword: values.newPassword }),
          )}
        >
          <FieldGroup>
            <Field data-invalid={errors.newPassword ? true : undefined}>
              <FieldLabel htmlFor="newPassword">New password</FieldLabel>
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!errors.newPassword}
                aria-describedby={
                  errors.newPassword ? "newPassword-error" : undefined
                }
                {...register("newPassword")}
              />
              <FieldError
                id="newPassword-error"
                errors={[errors.newPassword]}
              />
            </Field>

            <Field data-invalid={errors.confirmPassword ? true : undefined}>
              <FieldLabel htmlFor="confirmPassword">Repeat it</FieldLabel>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!errors.confirmPassword}
                aria-describedby={
                  errors.confirmPassword ? "confirmPassword-error" : undefined
                }
                {...register("confirmPassword")}
              />
              <FieldError
                id="confirmPassword-error"
                errors={[errors.confirmPassword]}
              />
            </Field>

            <Button type="submit" className="w-full" disabled={reset.isPending}>
              {reset.isPending && <Spinner data-icon="inline-start" />}
              Update password
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
