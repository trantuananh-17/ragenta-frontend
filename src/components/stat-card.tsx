import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  /**
   * The value is a name, not a number — a model id, a chunking method.
   *
   * Display type suits a figure that has to be read at a glance and is wrong for
   * an identifier: `text-embedding-3-small` at `text-2xl` wraps onto two lines
   * and drags the card taller than the ones beside it, and `tabular-nums` does
   * nothing for a string.
   */
  identifier?: boolean;
}

/** One number and what it means. Used across the dashboard and the summaries. */
export function StatCard({
  label,
  value,
  hint,
  icon,
  className,
  identifier,
}: StatCardProps) {
  return (
    <div className={cn("rounded-lg border bg-background p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground uppercase">
          {label}
        </p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p
        className={cn(
          "mt-2 font-semibold",
          identifier
            ? "text-base break-words"
            : "text-2xl tabular-nums",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * `columns` is the count at the widest breakpoint. It is explicit because a
 * fixed four left the knowledge base summary's fifth card alone on a row of its
 * own, reading as a layout fault rather than as a fifth statistic.
 */
export function StatCardGrid({
  children,
  columns = 4,
}: {
  children: React.ReactNode;
  columns?: 3 | 4 | 5;
}) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2",
        columns === 3 && "lg:grid-cols-3",
        columns === 4 && "lg:grid-cols-4",
        columns === 5 && "lg:grid-cols-5",
      )}
    >
      {children}
    </div>
  );
}
