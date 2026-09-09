"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowData,
} from "@tanstack/react-table";
import { InboxIcon, PlusIcon, SearchIcon } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import {
  CONTENT_WIDTHS,
  type ContentWidth,
} from "@/components/detail-shell";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
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

declare module "@tanstack/react-table" {
  // Both parameters go unused here, but they are part of `ColumnMeta`'s own
  // signature and declaration merging requires the identical list.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData extends RowData, TValue> {
    /**
     * How hard this column fights for horizontal room.
     *
     * A table that only scrolls sideways on a phone hides its own columns
     * behind a gesture nobody performs. Naming the ones that can wait lets the
     * narrow layout drop them instead: `secondary` comes back at `md`,
     * `tertiary` at `lg`. Leave it unset on the columns that identify the row
     * and on the actions — those never drop.
     */
    priority?: "secondary" | "tertiary";
  }
}

/** Where a column of each priority starts being rendered. */
const COLUMN_PRIORITY = {
  secondary: "hidden md:table-cell",
  tertiary: "hidden lg:table-cell",
} as const;

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

/**
 * A list screen's title, which is `PageHeader` plus the New button.
 *
 * It delegates rather than laying the title out itself: a list page and the
 * detail page it links to are the same rank, and rendering them through two
 * components is how they ended up at two heading sizes.
 */
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
    <PageHeader
      title={title}
      description={description}
      actions={
        <>
          {actions}
          {onNew && (
            <Button size="sm" disabled={disabled} onClick={onNew}>
              <PlusIcon data-icon="inline-start" />
              {newButtonLabel}
            </Button>
          )}
          {newButtonHref && (
            <Button size="sm" asChild>
              <Link href={newButtonHref} prefetch>
                <PlusIcon data-icon="inline-start" />
                {newButtonLabel}
              </Link>
            </Button>
          )}
        </>
      }
    />
  );
}

interface EntityContainerProps {
  header?: React.ReactNode;
  stats?: React.ReactNode;
  search?: React.ReactNode;
  /** Result counts or bulk actions — below the filters, outside the scroll area. */
  actions?: React.ReactNode;
  pagination?: React.ReactNode;
  /** Shares `DetailShell`'s scale, so a list and its detail page line up. */
  width?: ContentWidth;
  children: React.ReactNode;
}

export function EntityContainer({
  header,
  stats,
  search,
  actions,
  pagination,
  width = "wide",
  children,
}: EntityContainerProps) {
  return (
    <div className="flex h-full flex-col p-4 md:px-10 md:py-6">
      <div
        className={cn(
          "mx-auto flex min-h-0 w-full flex-1 flex-col gap-6",
          CONTENT_WIDTHS[width],
        )}
      >
        {header && <div className="shrink-0">{header}</div>}
        {stats && <div className="shrink-0">{stats}</div>}
        {search && <div className="shrink-0">{search}</div>}
        {actions && <div className="shrink-0">{actions}</div>}
        <div className="flex min-h-0 flex-1 flex-col overflow-auto rounded-md border bg-background">
          {children}
        </div>
        {pagination && <div className="shrink-0">{pagination}</div>}
      </div>
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
    <InputGroup className={cn("w-full bg-background", className)}>
      <InputGroupAddon>
        <SearchIcon />
      </InputGroupAddon>
      <InputGroupInput
        type="search"
        aria-label={placeholder}
        placeholder={placeholder}
        value={localValue}
        onChange={(event) => setLocalValue(event.target.value)}
      />
    </InputGroup>
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
            {headerGroup.headers.map((header) => {
              const priority = header.column.columnDef.meta?.priority;
              return (
                <TableHead
                  key={header.id}
                  className={priority && COLUMN_PRIORITY[priority]}
                >
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                </TableHead>
              );
            })}
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
            {row.getVisibleCells().map((cell) => {
              const priority = cell.column.columnDef.meta?.priority;
              return (
                <TableCell
                  key={cell.id}
                  className={priority && COLUMN_PRIORITY[priority]}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              );
            })}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * A list's loading state, shaped like the table that replaces it.
 *
 * A centred spinner tells you only that something is happening, then reflows
 * the whole page when the rows land. Rows of the right height in the right
 * number of columns hold the layout still, so the resolved table appears in
 * place rather than pushing everything down.
 */
export function EntityTableSkeleton({
  columns,
  rows = 8,
}: {
  columns: number;
  rows?: number;
}) {
  // Mirrors what the resolved table will drop at each width, so the skeleton
  // does not show six columns on a phone that is about to render two.
  const columnClass = (column: number) =>
    column < 2 ? undefined : column < 4 ? COLUMN_PRIORITY.secondary : COLUMN_PRIORITY.tertiary;

  return (
    <Table aria-busy>
      <TableHeader>
        <TableRow>
          {Array.from({ length: columns }).map((_, column) => (
            <TableHead key={column} className={columnClass(column)}>
              <Skeleton className="h-3.5 w-20" />
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from({ length: rows }).map((_, row) => (
          <TableRow key={row}>
            {Array.from({ length: columns }).map((_, column) => (
              <TableCell key={column} className={columnClass(column)}>
                {/* The first column carries the name, so it is the wide one. */}
                <Skeleton className={cn("h-4", column === 0 ? "w-40" : "w-24")} />
              </TableCell>
            ))}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
