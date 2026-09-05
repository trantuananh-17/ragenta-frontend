import { cn } from "@/lib/utils";

/**
 * The product mark. A rounded violet tile carrying an R, matching the admin
 * console and the marketing site's brand ramp — the three surfaces are meant to
 * read as one product, so this stays in step with them rather than acquiring its
 * own colour.
 */
export function RagentaLogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-primary-foreground",
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
