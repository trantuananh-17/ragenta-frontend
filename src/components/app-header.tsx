"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { navGroups } from "@/components/app-sidebar";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { CreditsIndicator } from "@/features/billing/components/credits-indicator";

/**
 * Destinations the top bar can name that are not in the sidebar.
 *
 * Everything else comes from `navGroups`, so the bar and the sidebar cannot
 * disagree about what a section is called.
 */
const EXTRA_DESTINATIONS = [{ title: "Account", url: "/account" }] as const;

/**
 * Where you are, in the same shape the admin console uses.
 *
 * On a detail route the section stays a link — that is the way back to the
 * list — and the record's own name is left to the page's `h1`. Repeating it
 * here would say the same thing twice in two sizes, which is what this bar
 * used to do on every index page.
 */
function useTrail() {
  const pathname = usePathname();

  const destinations = [
    ...navGroups.flatMap((group) =>
      group.items.map((item) => ({ group: group.label, ...item })),
    ),
    ...EXTRA_DESTINATIONS.map((item) => ({ group: undefined, ...item })),
  ];

  const match = destinations
    // Longest match wins: "/settings" is a prefix of "/settings/members".
    .filter(
      (item) => pathname === item.url || pathname.startsWith(`${item.url}/`),
    )
    .sort((a, b) => b.url.length - a.url.length)[0];

  if (!match) return null;
  return { ...match, isSection: pathname === match.url };
}

export function AppHeader() {
  const trail = useTrail();

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b bg-background px-4">
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger />
        {trail && (
          <Breadcrumb className="min-w-0">
            <BreadcrumbList>
              {trail.group && (
                <>
                  <BreadcrumbItem className="hidden sm:block">
                    {trail.group}
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden sm:block" />
                </>
              )}
              <BreadcrumbItem className="min-w-0">
                {trail.isSection ? (
                  <BreadcrumbPage className="truncate">
                    {trail.title}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink asChild>
                    <Link href={trail.url} className="truncate">
                      {trail.title}
                    </Link>
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        )}
      </div>
      <div className="flex items-center gap-2">
        <CreditsIndicator />
        <ThemeToggleButton />
      </div>
    </header>
  );
}
