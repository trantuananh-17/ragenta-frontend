"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { useWorkspaceId } from "@/features/workspace/components/workspace-provider";
import { chatOptions } from "../options/chat.options";

/**
 * Recent conversations, in the sidebar's Chats tab.
 *
 * Non-suspending on purpose: the shell renders around every page, and a
 * suspended sidebar would hold back the screen the user actually asked for.
 */
export function ChatSessionsNav() {
  const workspaceId = useWorkspaceId();
  const pathname = usePathname();
  const { data, isLoading } = useQuery(chatOptions.conversations(workspaceId));

  return (
    <SidebarGroup>
      <SidebarGroupContent className="space-y-2">
        <Button
          asChild
          size="sm"
          className="w-full justify-start group-data-[collapsible=icon]:justify-center"
        >
          <Link href="/chat">
            <Plus className="size-4" />
            <span className="group-data-[collapsible=icon]:hidden">
              New chat
            </span>
          </Link>
        </Button>

        <SidebarMenu>
          {isLoading &&
            [0, 1, 2, 3].map((row) => (
              <SidebarMenuItem key={row}>
                <SidebarMenuSkeleton />
              </SidebarMenuItem>
            ))}

          {data?.items.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
              No conversations yet. Ask something and it will appear here.
            </p>
          )}

          {data?.items.map((conversation) => (
            <SidebarMenuItem key={conversation.id}>
              <SidebarMenuButton
                asChild
                tooltip={conversation.title}
                isActive={pathname === `/chat/${conversation.id}`}
                className="h-9"
              >
                <Link href={`/chat/${conversation.id}`}>
                  <MessageSquare className="size-4" />
                  <span className="truncate">{conversation.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
