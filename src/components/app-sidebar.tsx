"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  CreditCard,
  FolderKanban,
  MessagesSquare,
  Settings2,
  Users,
} from "lucide-react";

import { NavUser } from "@/components/nav-user";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { ChatSessionsNav } from "@/features/chat/components/chat-sessions-nav";
import { WorkspaceSwitcher } from "@/features/workspace/components/workspace-switcher";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { cn } from "@/lib/utils";
import { CommandPaletteTrigger } from "./command-palette";

type NavItem = { title: string; icon: typeof BarChart3; url: string };
type NavGroup = { label?: string; items: NavItem[] };

/**
 * The nav is the product's table of contents. Work first — what someone opens
 * the app to do — then the workspace's own administration.
 */
const navGroups: NavGroup[] = [
  {
    items: [
      { title: "Chat", icon: MessagesSquare, url: "/chat" },
      { title: "Knowledge", icon: BookOpen, url: "/knowledge" },
      { title: "Projects", icon: FolderKanban, url: "/projects" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { title: "Usage", icon: BarChart3, url: "/usage" },
      { title: "Members", icon: Users, url: "/settings/members" },
      { title: "Billing", icon: CreditCard, url: "/settings/billing" },
      { title: "Settings", icon: Settings2, url: "/settings" },
    ],
  },
];

const SIDEBAR_TABS = ["workspace", "chats"] as const;
type SidebarTab = (typeof SIDEBAR_TABS)[number];

/**
 * The sidebar carries two different things — the app's destinations and the
 * user's own conversations — and they compete for the same column. A segmented
 * toggle gives each the full height instead of stacking a truncated list under
 * the nav.
 */
function SidebarTabToggle({
  tab,
  onChange,
}: {
  tab: SidebarTab;
  onChange: (tab: SidebarTab) => void;
}) {
  return (
    <div className="flex rounded-lg bg-sidebar-accent p-0.5 group-data-[collapsible=icon]:hidden">
      {SIDEBAR_TABS.map((candidate) => (
        <button
          key={candidate}
          type="button"
          onClick={() => onChange(candidate)}
          className={cn(
            "flex-1 rounded-md px-2 py-1 text-xs font-medium capitalize transition-colors",
            candidate === tab
              ? "bg-background text-foreground shadow-xs"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {candidate}
        </button>
      ))}
    </div>
  );
}

function WorkspaceNav() {
  const pathname = usePathname();

  return (
    <>
      {navGroups.map((group, index) => (
        <SidebarGroup key={group.label ?? `group-${index}`}>
          {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton
                    asChild
                    tooltip={item.title}
                    // `/settings` is a prefix of every other settings route, so
                    // it matches exactly or it would light up on all of them.
                    isActive={
                      item.url === "/settings"
                        ? pathname === "/settings"
                        : pathname === item.url ||
                          pathname.startsWith(`${item.url}/`)
                    }
                    className="h-9 gap-x-3 px-3"
                  >
                    <Link href={item.url} prefetch>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: { name?: string | null; email: string; image?: string | null };
}) {
  const [tab, setTab] = usePersistentState<SidebarTab>(
    "ragenta.sidebar-tab",
    "workspace",
    SIDEBAR_TABS,
  );

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="gap-3">
        <SidebarMenu>
          <SidebarMenuItem className="flex items-center gap-1 group-data-[collapsible=icon]:flex-col">
            <div className="min-w-0 flex-1 group-data-[collapsible=icon]:w-full group-data-[collapsible=icon]:flex-none">
              <WorkspaceSwitcher />
            </div>
            <CommandPaletteTrigger />
          </SidebarMenuItem>
        </SidebarMenu>
        <SidebarTabToggle tab={tab} onChange={setTab} />
      </SidebarHeader>

      <SidebarContent>
        {tab === "workspace" ? <WorkspaceNav /> : <ChatSessionsNav />}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem className="group-data-[collapsible=icon]:hidden">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="w-full justify-start"
            >
              <Link href="/settings/billing">
                <CreditCard className="size-4" />
                Credits and plan
              </Link>
            </Button>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <NavUser user={user} />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
