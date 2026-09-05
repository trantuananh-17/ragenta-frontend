"use client";

import Link from "next/link";
import {
  ChevronsUpDown,
  CreditCard,
  LogOut,
  Settings2,
  UserCircle,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useLogout } from "@/features/auth/hooks/auth.hook";
import { useBillingSummary } from "@/features/billing/hooks/billing.hook";
import { useWorkspaceId } from "@/features/workspace/components/workspace-provider";
import { formatCredits } from "@/lib/format";

function initials(name: string | null | undefined, email: string): string {
  const source = name?.trim() || email;
  return source.slice(0, 2).toUpperCase();
}

/**
 * The account menu at the foot of the sidebar. The credit balance lives here
 * rather than as a row of its own: it belongs with the other account-level facts,
 * and a row you cannot click to do anything is wasted nav.
 */
export function NavUser({
  user,
}: {
  user: { name?: string | null; email: string; image?: string | null };
}) {
  const workspaceId = useWorkspaceId();
  const logout = useLogout();
  const billing = useBillingSummary(workspaceId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent"
        >
          <Avatar className="size-7 rounded-md">
            {user.image && <AvatarImage src={user.image} alt="" />}
            <AvatarFallback className="rounded-md text-xs">
              {initials(user.name, user.email)}
            </AvatarFallback>
          </Avatar>
          <div className="grid flex-1 text-left leading-tight">
            <span className="truncate text-sm font-medium">
              {user.name || user.email}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              {billing.data
                ? `${formatCredits(billing.data.credits.total)} credits`
                : user.email}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto size-4 opacity-60" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
      >
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          {user.email}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/account">
            <UserCircle className="size-4" />
            Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings2 className="size-4" />
            Workspace settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/billing">
            <CreditCard className="size-4" />
            Billing and credits
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={logout.isPending}
          onSelect={() => logout.mutate()}
        >
          <LogOut className="size-4" />
          {logout.isPending ? "Signing out..." : "Sign out"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
