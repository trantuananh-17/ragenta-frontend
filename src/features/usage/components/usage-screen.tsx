"use client";

import { useQueryStates } from "nuqs";
import {
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from "recharts";

import { EntityPagination } from "@/components/entity-components";
import { PageHeader } from "@/components/page-header";
import { StatCard, StatCardGrid } from "@/components/stat-card";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWorkspace } from "@/features/workspace/components/workspace-provider";
import { formatCredits, formatDateTime, formatNumber } from "@/lib/format";
import { totalPages } from "@/lib/pagination";
import {
  useUsageRecordsSuspense,
  useUsageSummarySuspense,
} from "../hooks/usage.hook";
import { usageParams } from "../params";
import { USAGE_OPERATIONS } from "../service/usage.service";

const ALL_OPERATIONS = "__all__";

const chartConfig = {
  credits: { label: "Credits", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * What the workspace spent and on what.
 *
 * Credits, not tokens, are the unit throughout — that is what the ledger charges
 * and what a plan grants, and showing tokens as the headline would invite people
 * to compare two models by a number that does not decide the bill.
 */
export function UsageScreen() {
  const { workspace } = useWorkspace();
  const [params, setParams] = useQueryStates(usageParams);
  const summary = useUsageSummarySuspense(workspace.id, params.days);
  const records = useUsageRecordsSuspense(workspace.id, params);

  const byModel = summary.data.breakdown
    .map((row) => ({
      label: row.model,
      credits: Math.round(row.credits),
      calls: row.calls,
    }))
    .sort((left, right) => right.credits - left.credits)
    .slice(0, 8);

  const totalCalls = summary.data.breakdown.reduce(
    (total, row) => total + row.calls,
    0,
  );

  return (
    <div className="flex h-full flex-col gap-6 overflow-auto p-4 md:px-10 md:py-6">
      <PageHeader
        title="Usage"
        description="Every charge the workspace has taken, priced from the provider's own token counts."
        actions={
          <Select
            value={String(params.days)}
            onValueChange={(value) =>
              setParams({ days: Number(value), page: 1 })
            }
          >
            <SelectTrigger size="sm" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        }
      />

      <StatCardGrid>
        <StatCard
          label="Credits spent"
          value={formatCredits(Math.round(summary.data.totalCredits))}
          hint={`Since ${formatDateTime(summary.data.since)}`}
        />
        <StatCard label="Calls" value={formatNumber(totalCalls)} />
        <StatCard
          label="Models used"
          value={formatNumber(
            new Set(summary.data.breakdown.map((row) => row.model)).size,
          )}
        />
        <StatCard
          label="Operations"
          value={formatNumber(
            new Set(summary.data.breakdown.map((row) => row.operation)).size,
          )}
          hint="chat, embedding, ingestion"
        />
      </StatCardGrid>

      {byModel.length > 0 && (
        <div className="rounded-lg border bg-background p-4">
          <h2 className="mb-4 text-sm font-medium">Credits by model</h2>
          <ChartContainer config={chartConfig} className="h-56 w-full">
            <BarChart data={byModel} margin={{ left: 8, right: 8 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="text-[10px]"
              />
              <YAxis tickLine={false} axisLine={false} width={56} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="credits" fill="var(--color-credits)" radius={4} />
            </BarChart>
          </ChartContainer>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-medium">Charges</h2>
          <Select
            value={params.operation || ALL_OPERATIONS}
            onValueChange={(value) =>
              setParams({
                operation: value === ALL_OPERATIONS ? "" : value,
                page: 1,
              })
            }
          >
            <SelectTrigger size="sm" className="w-40">
              <SelectValue placeholder="All operations" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_OPERATIONS}>All operations</SelectItem>
              {USAGE_OPERATIONS.map((operation) => (
                <SelectItem key={operation} value={operation}>
                  {operation}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-hidden rounded-lg border bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Model</TableHead>
                <TableHead className="text-right">In</TableHead>
                <TableHead className="text-right">Out</TableHead>
                <TableHead className="text-right">Credits</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.data.items.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Nothing charged in this window.
                  </TableCell>
                </TableRow>
              )}
              {records.data.items.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                    {formatDateTime(record.createdAt)}
                  </TableCell>
                  <TableCell className="text-xs">{record.operation}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-xs">
                    {record.model}
                    <span className="ml-1 text-muted-foreground">
                      {record.provider}
                    </span>
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {formatNumber(
                      record.inputTokens + record.embeddingTokens,
                    )}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {formatNumber(record.outputTokens)}
                  </TableCell>
                  <TableCell className="text-right text-xs tabular-nums">
                    {formatCredits(Math.round(record.credits))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <EntityPagination
          page={params.page}
          totalPages={totalPages(records.data.total, records.data.limit)}
          onPageChange={(page) => setParams({ page })}
          infoText={`${formatNumber(records.data.total)} charges`}
        />
      </div>
    </div>
  );
}

export function UsageLoading() {
  return (
    <div className="space-y-6 p-4 md:px-10 md:py-6">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-56 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}

export function UsageError() {
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
      Usage could not be loaded.
    </div>
  );
}
