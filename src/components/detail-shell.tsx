import { cn } from "@/lib/utils";

/**
 * The scroll container every detail screen sits in. List screens get theirs from
 * `EntityContainer`; this is its counterpart, and the two together are why a
 * detail page and a list page have the same margins.
 */
export function DetailShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-full space-y-6 overflow-auto p-4 md:px-10 md:py-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A titled block of a detail screen. */
export function DetailSection({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("rounded-lg border bg-background p-4 md:p-6", className)}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-semibold">{title}</h2>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Label/value pairs — the read-only half of a detail screen. */
export function DetailList({
  items,
  className,
}: {
  items: { label: string; value: React.ReactNode }[];
  className?: string;
}) {
  return (
    <dl className={cn("grid gap-4 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <dt className="text-xs text-muted-foreground uppercase">{item.label}</dt>
          <dd className="text-sm break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
