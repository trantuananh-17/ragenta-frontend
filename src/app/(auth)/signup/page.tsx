import type { Metadata } from "next";

import { SignUpForm } from "@/features/auth/components";
import { requireUnAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Create an account" };

export default async function SignUpPage() {
  await requireUnAuth();
  return <SignUpForm />;
}
