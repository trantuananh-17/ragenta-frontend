import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/**
 * The product mark. A rounded violet tile carrying an R, matching the admin
 * console and the marketing site's brand ramp — the three surfaces are meant to
 * read as one product, so this stays in step with them rather than acquiring its
 * own colour.
 */
export function RagentaLogoMark({
  className,
  style,
}: {
  className?: string;
  /** Only the embedded-chat preview tints the mark with a customer's accent. */
  style?: CSSProperties;
}) {
  return (
    <span
      aria-hidden
      style={style}
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground",
        className,
      )}
    >
      R
    </span>
  );
}

export function RagentaLogo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <RagentaLogoMark />
      <span className="text-sm font-semibold tracking-tight">Ragenta</span>
    </span>
  );
}
