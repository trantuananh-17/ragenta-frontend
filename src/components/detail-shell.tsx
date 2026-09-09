import { InfoHint } from "@/components/info-hint";
import { cn } from "@/lib/utils";

/**
 * How wide a screen's content is allowed to get.
 *
 * Shared with `EntityContainer` so a list page and a detail page in the same
 * section stop at the same place. Below the chosen width nothing changes; above
 * it the column centres instead of stretching, because a settings form or a
 * paragraph of description spanning 2500px is unreadable however much room the
 * display has.
 *
 *   wide    tables, dashboards, anything scannable in columns
 *   medium  detail screens and settings — the default reading width
 *   narrow  a single form
 *   full    surfaces that own their own layout: the flow canvas, chat
 */
export const CONTENT_WIDTHS = {
  full: "",
  wide: "max-w-7xl",
  medium: "max-w-5xl",
  narrow: "max-w-2xl",
} as const;

export type ContentWidth = keyof typeof CONTENT_WIDTHS;

/**
 * The scroll container every detail screen sits in. List screens get theirs from
 * `EntityContainer`; this is its counterpart, and the two together are why a
 * detail page and a list page have the same margins.
 */
export function DetailShell({
  children,
  width = "wide",
  fill = false,
  className,
}: {
  children: React.ReactNode;
  width?: ContentWidth;
  /**
   * The screen manages its own scrolling — a two-pane layout, a canvas. The
   * shell then stops scrolling and hands its full height down instead.
   */
  fill?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "h-full p-4 md:px-10 md:py-6",
        fill ? "overflow-hidden" : "overflow-auto",
      )}
    >
      <div
        className={cn(
          "mx-auto flex w-full flex-col gap-6",
          fill && "h-full min-h-0",
          CONTENT_WIDTHS[width],
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** A titled block of a detail screen. */
export function DetailSection({
  title,
  description,
  info,
  actions,
  children,
  className,
}: {
  title: string;
  description?: React.ReactNode;
  /** The longer explanation, shown on hover beside the title. */
  info?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("rounded-lg border bg-background p-4 md:p-6", className)}
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="flex items-center gap-1.5 text-base font-semibold">
            {title}
            {info && <InfoHint label={`About ${title}`}>{info}</InfoHint>}
          </h2>
          {description && (
            <p className="max-w-prose text-sm text-muted-foreground">
              {description}
            </p>
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
        <div key={item.label} className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-muted-foreground">
            {item.label}
          </dt>
          <dd className="text-sm break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
