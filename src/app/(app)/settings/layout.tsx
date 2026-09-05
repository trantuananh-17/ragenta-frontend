import Link from "next/link";

import { SettingsTabs } from "@/components/settings-tabs";

/**
 * Everything about the workspace itself, under one sub-nav. Members, models and
 * billing are settings of the same object — splitting them across three
 * top-level destinations would make "where do I change X" a guess.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col overflow-auto">
      <div className="border-b bg-background px-4 pt-4 md:px-10">
        <h1 className="text-xl font-semibold tracking-tight">
          Workspace settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Who is in it, what it runs on, and what it costs.{" "}
          <Link href="/account" className="text-primary hover:underline">
            Your own account
          </Link>{" "}
          is separate.
        </p>
        <SettingsTabs />
      </div>
      <div className="flex-1 p-4 md:px-10 md:py-6">{children}</div>
    </div>
  );
}
