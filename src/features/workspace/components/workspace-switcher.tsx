"use client";

import { Check, ChevronsUpDown, Plus } from "lucide-react";
import Link from "next/link";

import { RagentaLogoMark } from "@/components/ragenta-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { useSwitchWorkspace } from "../hooks/workspace.hook";
import { useWorkspace } from "./workspace-provider";

/**
 * Identity and tenant in one control, at the top of the sidebar — the workspace
 * name is the first thing that has to be unambiguous, because every screen below
 * it is scoped to whichever one is selected.
 */
export function WorkspaceSwitcher() {
  const { workspace, workspaces } = useWorkspace();
  const switchWorkspace = useSwitchWorkspace();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <SidebarMenuButton
          size="lg"
          className="data-[state=open]:bg-sidebar-accent"
        >
          <RagentaLogoMark />
          <div className="grid flex-1 text-left leading-tight">
            <span className="truncate text-sm font-semibold">
              {workspace.name}
            </span>
            <span className="truncate text-xs text-muted-foreground capitalize">
              {workspace.role}
            </span>
          </div>
          <ChevronsUpDown className="ml-auto size-4 opacity-60" />
        </SidebarMenuButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
      >
        <DropdownMenuLabel className="text-xs text-muted-foreground">
          Workspaces
        </DropdownMenuLabel>
        {workspaces.map((candidate) => (
          <DropdownMenuItem
            key={candidate.id}
            disabled={switchWorkspace.isPending}
            onSelect={() => {
              if (candidate.id !== workspace.id) {
                switchWorkspace.mutate(candidate.id);
              }
            }}
          >
            <span className="truncate">{candidate.name}</span>
            {candidate.id === workspace.id && (
              <Check className="ml-auto size-4" />
            )}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/onboarding">
            <Plus className="size-4" />
            New workspace
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
