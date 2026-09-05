"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { InboxIcon, PlusIcon, SearchIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardTitle,
} from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";

/**
 * The scaffolding every list screen is built from. A feature supplies its
 * columns, its toolbar and its query hook; the shape of the page comes from
 * here, so a dozen screens look and behave like one product.
 */

type EntityHeaderProps = {
  title: string;
  description?: string;
  newButtonLabel?: string;
  disabled?: boolean;
  actions?: React.ReactNode;
} & (
  | { onNew: () => void; newButtonHref?: never }
  | { newButtonHref: string; onNew?: never }
  | { onNew?: never; newButtonHref?: never }
);

export function EntityHeader({
  title,
  description,
  onNew,
  newButtonHref,
  newButtonLabel = "New",
  disabled,
  actions,
}: EntityHeaderProps) {
  return (
    <div className="flex flex-row items-center justify-between gap-x-4">
      <div className="flex flex-col">
        <h1 className="text-lg font-semibold md:text-xl">{title}</h1>
        {description && (
          <p className="text-xs text-muted-foreground md:text-sm">
            {description}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {onNew && (
          <Button size="sm" disabled={disabled} onClick={onNew}>
            <PlusIcon className="size-4" />
            {newButtonLabel}
          </Button>
        )}
        {newButtonHref && (
          <Button size="sm" asChild>
            <Link href={newButtonHref} prefetch>
              <PlusIcon className="size-4" />
              {newButtonLabel}
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

interface EntityContainerProps {
  header?: React.ReactNode;
  stats?: React.ReactNode;
  search?: React.ReactNode;
  /** Result counts or bulk actions — below the filters, outside the scroll area. */
  actions?: React.ReactNode;
  pagination?: React.ReactNode;
  children: React.ReactNode;
}

export function EntityContainer({
  header,
  stats,
  search,
  actions,
  pagination,
  children,
}: EntityContainerProps) {
  return (
    <div className="flex h-full flex-col gap-y-6 p-4 md:px-10 md:py-6">
      {header && <div className="shrink-0">{header}</div>}
      {stats && <div className="shrink-0">{stats}</div>}
      {search && <div className="shrink-0">{search}</div>}
      {actions && <div className="shrink-0">{actions}</div>}
      <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-md border bg-background">
        {children}
      </div>
      {pagination && <div className="shrink-0">{pagination}</div>}
    </div>
  );
}

interface EntitySearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function EntitySearch({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: EntitySearchProps) {
  const [localValue, setLocalValue] = useState(value);
  const [lastExternalValue, setLastExternalValue] = useState(value);
  const debouncedValue = useDebouncedValue(localValue, 400);

  // Keeps the box in step when the URL changes from somewhere else — a cleared
  // filter, the back button — rather than from typing here. Adjusted during
  // render rather than in an effect: an effect would paint the stale value first
  // and then correct it.
  if (value !== lastExternalValue) {
    setLastExternalValue(value);
    setLocalValue(value);
  }

  useEffect(() => {
    if (debouncedValue !== value) onChange(debouncedValue);
    // `onChange` is a new closure on every render of the caller; depending on it
    // would re-run this effect continuously.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue]);

  return (
    <div className={cn("relative w-full", className)}>
      <SearchIcon className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
      <Input
        className="w-full border-border bg-background pl-8 shadow-none"
        placeholder={placeholder}
        value={localValue}
        onChange={(event) => setLocalValue(event.target.value)}
      />
    </div>
  );
}

interface EntityPaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
  infoText?: React.ReactNode;
}

export function EntityPagination({
  page,
  totalPages,
  onPageChange,
  disabled,
  infoText,
}: EntityPaginationProps) {
  return (
    <div className="flex w-full items-center justify-between gap-x-2">
      <div className="flex-1 text-sm text-muted-foreground">
        Page {page} of {totalPages || 1}
        {infoText && <span className="ml-2 text-xs">{infoText}</span>}
      </div>
      <div className="flex items-center justify-end gap-x-2 py-4">
        <Button
          disabled={disabled || page <= 1}
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, page - 1))}
        >
          Previous
        </Button>
        <Button
          disabled={disabled || page >= totalPages || totalPages === 0}
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

interface EntityStateViewProps {
  icon?: React.ReactNode;
  title?: string;
  message?: string;
  content?: React.ReactNode;
}

export function EntityStateView({
  icon,
  title = "Loading",
  message,
  content,
}: EntityStateViewProps) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <Empty className="border border-dashed bg-background">
        <EmptyHeader>
          <EmptyMedia variant="icon">{icon ?? <InboxIcon />}</EmptyMedia>
          <EmptyTitle>{title}</EmptyTitle>
          {message && <EmptyDescription>{message}</EmptyDescription>}
        </EmptyHeader>
        {content && <EmptyContent>{content}</EmptyContent>}
      </Empty>
    </div>
  );
}

interface EntityEmptyViewProps extends EntityStateViewProps {
  onNew?: () => void;
  newLabel?: string;
  disabled?: boolean;
}

export function EntityEmptyView({
  onNew,
  newLabel = "New",
  disabled,
  ...props
}: EntityEmptyViewProps) {
  return (
    <EntityStateView
      {...props}
      content={
        onNew && (
          <Button size="sm" onClick={onNew} disabled={disabled}>
            <PlusIcon className="size-4" />
            {newLabel}
          </Button>
        )
      }
    />
  );
}

interface EntityListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getKey?: (item: T, index: number) => string | number;
  emptyView?: React.ReactNode;
  className?: string;
}

export function EntityList<T>({
  items,
  renderItem,
  getKey,
  emptyView,
  className,
}: EntityListProps<T>) {
  if (items.length === 0 && emptyView) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="mx-auto max-w-sm">{emptyView}</div>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-y-4", className)}>
      {items.map((item, index) => (
        <div key={getKey ? getKey(item, index) : index}>
          {renderItem(item, index)}
        </div>
      ))}
    </div>
  );
}

interface EntityItemProps {
  href: string;
  title: string;
  subtitle?: React.ReactNode;
  image?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function EntityItem({
  href,
  title,
  subtitle,
  image,
  actions,
  className,
}: EntityItemProps) {
  return (
    <Link href={href} prefetch>
      <Card
        className={cn("cursor-pointer p-4 shadow-none hover:shadow", className)}
      >
        <CardContent className="flex flex-row items-center justify-between p-0">
          <div className="flex items-center gap-3">
            {image}
            <div>
              <CardTitle className="text-base font-medium">{title}</CardTitle>
              {subtitle && (
                <CardDescription className="text-xs">{subtitle}</CardDescription>
              )}
            </div>
          </div>
          {actions && <div className="flex items-center gap-x-4">{actions}</div>}
        </CardContent>
      </Card>
    </Link>
  );
}

interface EntityDataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyView?: React.ReactNode;
  /** With filters applied, "no results" is the honest message — not "nothing exists". */
  hasFilters?: boolean;
  noResultsText?: string;
  onRowClick?: (row: TData) => void;
  stickyHeader?: boolean;
}

export function EntityDataTable<TData, TValue>({
  columns,
  data,
  emptyView,
  hasFilters = false,
  noResultsText = "No results. Try adjusting the filters.",
  onRowClick,
  stickyHeader = true,
}: EntityDataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (data.length === 0) {
    if (emptyView && !hasFilters) return <div className="flex-1">{emptyView}</div>;
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">{noResultsText}</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader
        className={cn(stickyHeader && "sticky top-0 z-10 bg-background")}
      >
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {table.getRowModel().rows.map((row) => (
          <TableRow
            key={row.id}
            onClick={onRowClick ? () => onRowClick(row.original) : undefined}
            className={onRowClick ? "cursor-pointer hover:bg-muted/50" : undefined}
          >
            {row.getVisibleCells().map((cell) => (
              <TableCell key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
