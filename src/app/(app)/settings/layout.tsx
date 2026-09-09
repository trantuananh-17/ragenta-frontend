import Link from "next/link";

import { PageHeader } from "@/components/page-header";
import { SettingsTabs } from "@/components/settings-tabs";
import { CONTENT_WIDTHS } from "@/components/detail-shell";
import { cn } from "@/lib/utils";

/**
 * Everything about the workspace itself, under one sub-nav. Members, models and
 * billing are settings of the same object — splitting them across three
 * top-level destinations would make "where do I change X" a guess.
 *
 * The title band and the pages below it share `DetailShell`'s own width, not a
 * narrower one. Settings is reached from the same sidebar as Usage and Agents,
 * and a narrower column here made the whole page jump inward on the way in —
 * the tabs have to line up with the screens either side of them, not just with
 * the sections underneath.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="border-b bg-background px-4 pt-6 md:px-10">
        <div className={cn("mx-auto w-full", CONTENT_WIDTHS.wide)}>
          <PageHeader
            title="Workspace settings"
            description={
              <>
                Who is in it, what it runs on, and what it costs.{" "}
                <Link
                  href="/account"
                  className="rounded-sm text-primary hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  Your own account
                </Link>{" "}
                is separate.
              </>
            }
          />
          <SettingsTabs />
        </div>
      </div>
      <div className="flex-1 p-4 md:px-10 md:py-6">
        <div
          className={cn(
            "mx-auto flex w-full flex-col gap-6",
            CONTENT_WIDTHS.wide,
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
