import Link from "next/link";

import { RagentaLogo } from "@/components/ragenta-logo";

/** The signed-out shell: one centred card, no sidebar, no workspace. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-accent/20 p-6">
      <Link href="/">
        <RagentaLogo />
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
