import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm font-medium text-muted-foreground">404</p>
      <h1 className="text-2xl font-semibold tracking-tight">
        That page does not exist
      </h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        It may have been deleted, or it may belong to a workspace you are no
        longer a member of.
      </p>
      <Link href="/chat" className={buttonVariants()}>
        Back to chat
      </Link>
    </div>
  );
}
