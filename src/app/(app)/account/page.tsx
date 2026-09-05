import type { Metadata } from "next";

import { AccountScreen } from "@/features/account/components";
import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const session = await requireAuth();
  return <AccountScreen user={session.user} />;
}
