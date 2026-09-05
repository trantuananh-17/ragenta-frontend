"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAcceptInvitation } from "../hooks/auth.hook";

/**
 * An invitation is accepted as the signed-in account, so this is only reachable
 * behind the session gate — the page redirects an anonymous visitor to /login
 * with this URL as the return path, which is what makes "sign up, then accept"
 * work in one pass.
 */
export function AcceptInvitationCard({
  invitationId,
  email,
}: {
  invitationId: string;
  email: string;
}) {
  const accept = useAcceptInvitation();

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle>Join the workspace</CardTitle>
        <CardDescription>
          You are signed in as {email}. An invitation is addressed to the account
          it was sent to — if that is a different address, sign in as that one
          first.
        </CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Accepting takes a seat in the workspace and gives you the role the
        inviter chose.
      </CardContent>
      <CardFooter className="flex flex-col gap-3">
        <Button
          className="w-full"
          disabled={accept.isPending}
          onClick={() => accept.mutate(invitationId)}
        >
          {accept.isPending ? "Joining..." : "Accept invitation"}
        </Button>
        <Link
          href="/chat"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Not now
        </Link>
      </CardFooter>
    </Card>
  );
}
