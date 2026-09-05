"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function ChatLoading() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6">
      <Skeleton className="ml-auto h-12 w-2/3 rounded-2xl" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
}

export function ChatError() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 text-center text-sm text-muted-foreground">
      This conversation could not be loaded. It may have been deleted, or it may
      belong to another workspace.
    </div>
  );
}
