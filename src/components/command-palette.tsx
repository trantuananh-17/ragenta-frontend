"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  BookOpen,
  CreditCard,
  FolderKanban,
  MessagesSquare,
  Search,
  Settings2,
  Users,
} from "lucide-react";

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { chatOptions } from "@/features/chat/options/chat.options";
import { knowledgeOptions } from "@/features/knowledge/options/knowledge.options";
import { useWorkspaceId } from "@/features/workspace/components/workspace-provider";

/**
 * The palette state is module-level rather than a context: the trigger sits in
 * the sidebar and the dialog is mounted in the shell, and threading a provider
 * between them for one boolean is more machinery than the feature is worth.
 */
let openPalette: (() => void) | null = null;

const destinations = [
  { label: "Chat", icon: MessagesSquare, url: "/chat" },
  { label: "Knowledge bases", icon: BookOpen, url: "/knowledge" },
  { label: "Projects", icon: FolderKanban, url: "/projects" },
  { label: "Usage", icon: BarChart3, url: "/usage" },
  { label: "Members", icon: Users, url: "/settings/members" },
  { label: "Billing and credits", icon: CreditCard, url: "/settings/billing" },
  { label: "Workspace settings", icon: Settings2, url: "/settings" },
];

export function CommandPaletteTrigger() {
  return (
    <SidebarMenuButton
      tooltip="Search"
      className="size-8 shrink-0 justify-center p-0"
      onClick={() => openPalette?.()}
    >
      <Search className="size-4" />
      <span className="sr-only">Search</span>
    </SidebarMenuButton>
  );
}

/**
 * Mounted once in the shell, not in the sidebar: the hotkey has to work with the
 * sidebar collapsed, and a dialog inside the sidebar would be clipped by its
 * stacking context.
 */
export function CommandPalette() {
  const router = useRouter();
  const workspaceId = useWorkspaceId();
  const [open, setOpen] = useState(false);

  const conversations = useQuery({
    ...chatOptions.conversations(workspaceId),
    enabled: open,
  });
  const bases = useQuery({
    ...knowledgeOptions.bases(workspaceId),
    enabled: open,
  });

  useEffect(() => {
    openPalette = () => setOpen(true);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      openPalette = null;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const go = (url: string) => {
    setOpen(false);
    router.push(url);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search conversations, knowledge bases, pages..." />
      <CommandList>
        <CommandEmpty>Nothing matches that.</CommandEmpty>

        <CommandGroup heading="Go to">
          {destinations.map((destination) => (
            <CommandItem
              key={destination.url}
              value={destination.label}
              onSelect={() => go(destination.url)}
            >
              <destination.icon />
              {destination.label}
            </CommandItem>
          ))}
        </CommandGroup>

        {conversations.data && conversations.data.items.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Conversations">
              {conversations.data.items.slice(0, 8).map((conversation) => (
                <CommandItem
                  key={conversation.id}
                  value={`conversation ${conversation.title}`}
                  onSelect={() => go(`/chat/${conversation.id}`)}
                >
                  <MessagesSquare />
                  <span className="truncate">{conversation.title}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {bases.data && bases.data.items.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Knowledge bases">
              {bases.data.items.slice(0, 8).map((base) => (
                <CommandItem
                  key={base.id}
                  value={`knowledge ${base.name}`}
                  onSelect={() => go(`/knowledge/${base.id}`)}
                >
                  <BookOpen />
                  <span className="truncate">{base.name}</span>
                  <CommandShortcut>{base.documentCount} docs</CommandShortcut>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
