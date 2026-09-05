"use client";

import { usePathname } from "next/navigation";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import { CreditsIndicator } from "@/features/billing/components/credits-indicator";

/**
 * Which screen the top bar names. Detail routes deliberately fall back to their
 * section: the detail's own title is on the page itself, and repeating it here
 * would say the same thing twice in two different sizes.
 */
const SECTIONS: { prefix: string; title: string }[] = [
  { prefix: "/chat", title: "Chat" },
  { prefix: "/knowledge", title: "Knowledge" },
  { prefix: "/projects", title: "Projects" },
  { prefix: "/usage", title: "Usage" },
  { prefix: "/settings/members", title: "Members" },
  { prefix: "/settings/billing", title: "Billing" },
  { prefix: "/settings/models", title: "Models" },
  { prefix: "/settings", title: "Workspace settings" },
  { prefix: "/account", title: "Account" },
];

function sectionTitle(pathname: string): string {
  return (
    SECTIONS.find(
      (section) =>
        pathname === section.prefix || pathname.startsWith(`${section.prefix}/`),
    )?.title ?? "Ragenta"
  );
}

export function AppHeader() {
  const pathname = usePathname();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-4">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger />
        <span className="truncate text-sm font-medium">
          {sectionTitle(pathname)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <CreditsIndicator />
        <ThemeToggleButton />
      </div>
    </header>
  );
}
