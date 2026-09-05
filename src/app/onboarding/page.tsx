import type { Metadata } from "next";
import Link from "next/link";

import { RagentaLogo } from "@/components/ragenta-logo";
import { CreateWorkspaceCard } from "@/features/workspace/components/create-workspace-card";
import { requireAuth } from "@/lib/auth";
import { listWorkspaces } from "@/lib/workspace";

export const metadata: Metadata = { title: "Create a workspace" };

/**
 * Outside the (app) group on purpose: the shell needs a workspace to render, and
 * this is the screen that creates the first one. It is also reachable later, from
 * the workspace switcher, which is why it does not redirect a user who already
 * has one.
 */
export default async function OnboardingPage() {
  await requireAuth("/onboarding");
  const workspaces = await listWorkspaces();

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-accent/20 p-6">
      <Link href="/">
        <RagentaLogo />
      </Link>
      <div className="w-full max-w-md">
        <CreateWorkspaceCard existing={workspaces} />
      </div>
    </div>
  );
}
