"use client";

import { CheckCircle2 } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime, formatNumber } from "@/lib/format";
import { useProviderErrors } from "../hooks/provider-errors.hook";
import { explainStatus } from "../service/provider-errors.service";

/**
 * Calls to a model provider that failed, for the workspace that made them.
 *
 * The point is that a customer can read the provider's own refusal instead of
 * asking somebody to look at a log for them — so the message is shown verbatim,
 * next to what it usually means in terms of what *they* can do: their key, their
 * quota, their model choice.
 *
 * Only failures are recorded, so an empty table means nothing failed.
 */
export function ProviderErrorsPanel({ workspaceId }: { workspaceId: string }) {
  const { data: errors, isPending, isError } = useProviderErrors(workspaceId);

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Failures could not be loaded.
      </p>
    );
  }

  if (errors.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed p-10 text-center">
        <CheckCircle2 className="size-8 text-success" />
        <p className="font-medium">No provider call has failed</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Nothing is written here unless a call to a model provider failed, so an
          empty table is the healthy one.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        The last {formatNumber(errors.length)}{" "}
        {errors.length === 1 ? "failure" : "failures"}, newest first. The message
        is the provider&apos;s own.
      </p>

      <div className="overflow-hidden rounded-lg border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Operation</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>What it means</TableHead>
              <TableHead>Message</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {errors.map((error) => (
              <TableRow key={error.id}>
                <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                  {formatDateTime(error.createdAt)}
                </TableCell>
                <TableCell className="text-xs">{error.operation}</TableCell>
                <TableCell className="max-w-[200px] truncate text-xs">
                  {error.model ?? "—"}
                  <span className="ml-1 text-muted-foreground">
                    {error.provider}
                  </span>
                </TableCell>
                <TableCell>
                  {error.status === null ? (
                    <StatusBadge tone="neutral">no response</StatusBadge>
                  ) : (
                    <StatusBadge tone={error.status >= 500 ? "warning" : "danger"}>
                      {error.status}
                    </StatusBadge>
                  )}
                </TableCell>
                <TableCell className="max-w-[240px] text-xs text-muted-foreground">
                  {explainStatus(error.status)}
                </TableCell>
                <TableCell className="max-w-[280px]">
                  <span className="line-clamp-2 text-xs text-muted-foreground">
                    {error.message}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
