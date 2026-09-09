"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/settings", label: "General" },
  { href: "/settings/members", label: "Members" },
  { href: "/settings/models", label: "Models" },
  { href: "/settings/connections", label: "Connections" },
  { href: "/settings/data", label: "Databases" },
  { href: "/settings/embed", label: "Embedded chat" },
  { href: "/settings/webhooks", label: "Webhooks" },
  { href: "/settings/billing", label: "Billing" },
] as const;

/**
 * Sub-navigation for the settings section.
 *
 * Links rather than `Tabs`, because each one is a route with its own URL that
 * has to survive a reload and a shared link — `Tabs` would make them panels of
 * one page. It is a `nav` with `aria-current` for that reason: the underline
 * says which page you are on, and `aria-current` says the same thing to a
 * screen reader, which an underline alone does not.
 */
export function SettingsTabs() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Workspace settings"
      className="mt-6 flex gap-1 overflow-x-auto"
    >
      {TABS.map((tab) => {
        // "/settings" is a prefix of every other tab, so it matches exactly.
        const active =
          tab.href === "/settings"
            ? pathname === "/settings"
            : pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "-mb-px rounded-t-sm border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
