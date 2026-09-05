import type { Metadata } from "next";

import { AcceptInvitationCard } from "@/features/auth/components";
import { requireAuth } from "@/lib/auth";

export const metadata: Metadata = { title: "Join a workspace" };

/**
 * Accepting is done as the signed-in account, so an anonymous visitor is sent to
 * the gate with this URL as the return path — which is what makes "sign up from
 * the invitation email, then land back here" work in one pass.
 */
export default async function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ invitationId: string }>;
}) {
  const { invitationId } = await params;
  const session = await requireAuth(`/accept-invitation/${invitationId}`);

  return (
    <AcceptInvitationCard
      invitationId={invitationId}
      email={session.user.email}
    />
  );
}
