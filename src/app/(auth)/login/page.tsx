import { Suspense } from "react";
import type { Metadata } from "next";

import { LoginForm } from "@/features/auth/components";
import { requireUnAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  await requireUnAuth();

  // The form reads `redirect` from the URL, so it needs a Suspense boundary.
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
