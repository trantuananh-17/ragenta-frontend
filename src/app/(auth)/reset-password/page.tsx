import { Suspense } from "react";
import type { Metadata } from "next";

import { ResetPasswordForm } from "@/features/auth/components";

export const metadata: Metadata = { title: "Choose a new password" };

export default function ResetPasswordPage() {
  // The token arrives as a search param, which makes this a client read.
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
