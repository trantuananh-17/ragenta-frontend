"use client";

import { useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useWidgetUsage } from "../hooks/widgets.hook";
import type { Widget, WidgetUsage } from "../service/widgets.service";

const RANGES = [7, 30, 90] as const;

const whole = new Intl.NumberFormat("en");

function credits(value: string): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? whole.format(Math.round(parsed)) : value;
}

function duration(ms: number | null): string {
  if (ms === null) return "—";
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;
}

function when(value: string): string {
  return new Date(value).toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

/**
 * What one embedded chat has been doing.
 *
 * Opened per widget rather than rendered in the list: a workspace with ten
 * widgets should not make ten requests to draw a page nobody has clicked into.
 *
 * Today's spend against the ceiling leads, because "why did my chat stop
 * answering" is the question this panel exists for and the daily ceiling is the
 * usual answer — it is a real limit that silently turns a live widget into an
 * apologetic one until midnight UTC.
 */
export function WidgetActivityDialog({
  workspaceId,
  widget,
  open,
  onOpenChange,
}: {
  workspaceId: string;
  widget: Widget;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [days, setDays] = useState<number>(30);
  const { data, isPending } = useWidgetUsage(workspaceId, open ? widget.id : null, days);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{widget.name}</DialogTitle>
          <DialogDescription>
            Every message this chat has answered, and what it cost this workspace in
            credits.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end">
          <div className="flex rounded-md border p-0.5">
            {RANGES.map((range) => (
              <button
                key={range}
                type="button"
                onClick={() => setDays(range)}
                className={cn(
                  "rounded px-3 py-1 text-sm transition-colors",
                  range === days
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {range}d
              </button>
            ))}
          </div>
        </div>

        {isPending || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-5">
            <TodayCeiling today={data.today} />
            <Totals totals={data.totals} />
            <DailyMessages rows={data.daily} />
            <RecentLog rows={data.recent} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TodayCeiling({ today }: { today: WidgetUsage["today"] }) {
  const used = today.ceiling > 0 ? Math.min((today.spent / today.ceiling) * 100, 100) : 0;
  const exhausted = today.spent >= today.ceiling;

  return (
    <div className="rounded-md border p-3">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">Today&apos;s spend</span>
        <span className="tabular-nums">
          {whole.format(Math.round(today.spent))} / {whole.format(today.ceiling)} credits
        </span>
      </div>
      <Progress value={used} className="mt-2" />
      <p className="mt-2 text-xs text-muted-foreground">
        {exhausted
          ? "The ceiling is reached, so this chat is refusing visitors until midnight UTC. Raise it on the widget if that is not what you want."
          : "The ceiling resets at midnight UTC. A public chat with no cap is the clearest way to spend a balance by accident."}
      </p>
    </div>
  );
}

function Totals({ totals }: { totals: WidgetUsage["totals"] }) {
  const cells = [
    { label: "Messages", value: whole.format(totals?.messages ?? 0) },
    { label: "Answered", value: whole.format(totals?.succeeded ?? 0) },
    { label: "Failed", value: whole.format(totals?.failed ?? 0) },
    { label: "Credits", value: credits(totals?.credits ?? "0") },
    { label: "Average time", value: duration(totals?.avgDurationMs ?? null) },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {cells.map((cell) => (
        <div key={cell.label} className="rounded-md border p-3">
          <p className="text-xs text-muted-foreground uppercase">{cell.label}</p>
          <p className="mt-1 text-lg font-semibold tabular-nums">{cell.value}</p>
        </div>
      ))}
    </div>
  );
}

function DailyMessages({ rows }: { rows: WidgetUsage["daily"] }) {
  if (rows.length === 0) return null;

  const peak = Math.max(...rows.map((row) => row.messages), 1);

  return (
    <div className="rounded-md border p-3">
      <p className="text-sm font-medium">Messages per day</p>
      <div className="mt-3 flex h-20 items-end gap-1">
        {rows.map((row) => (
          <div
            key={row.day}
            className="flex-1 rounded-t bg-primary/70 transition-colors hover:bg-primary"
            style={{ height: `${Math.max((row.messages / peak) * 100, 3)}%` }}
            title={`${row.day} — ${row.messages} messages, ${credits(row.credits)} credits`}
          >
            <span className="sr-only">
              {row.day}: {row.messages} messages
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-muted-foreground">
        <span>{rows[0]?.day}</span>
        <span>{rows[rows.length - 1]?.day}</span>
      </div>
    </div>
  );
}

function RecentLog({ rows }: { rows: WidgetUsage["recent"] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-3 py-8 text-center text-sm text-muted-foreground">
        Nobody has used this chat in the selected range.
      </p>
    );
  }

  return (
    <div className="rounded-md border">
      <p className="border-b px-3 py-2 text-sm font-medium">Recent conversations</p>
      <div className="max-h-80 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Visitor asked</TableHead>
              <TableHead>Answered</TableHead>
              <TableHead className="text-right">Credits</TableHead>
              <TableHead className="text-right">Time</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                  {when(row.createdAt)}
                </TableCell>
                <TableCell className="max-w-64 truncate text-sm">
                  {row.question ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell className="max-w-64 truncate text-sm">
                  {row.status === "succeeded" ? (
                    (row.answer ?? <span className="text-muted-foreground">—</span>)
                  ) : (
                    <span className="flex items-center gap-2">
                      <StatusBadge tone="danger">{row.status}</StatusBadge>
                      <span className="truncate text-xs text-muted-foreground">
                        {row.error}
                      </span>
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {credits(row.credits)}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {duration(row.durationMs)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
