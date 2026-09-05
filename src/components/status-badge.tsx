import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

const toneClass: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground border-transparent",
  success:
    "bg-emerald-500/10 text-emerald-700 border-emerald-500/25 dark:text-emerald-400",
  warning:
    "bg-amber-500/10 text-amber-700 border-amber-500/25 dark:text-amber-400",
  danger: "bg-red-500/10 text-red-700 border-red-500/25 dark:text-red-400",
  info: "bg-sky-500/10 text-sky-700 border-sky-500/25 dark:text-sky-400",
};

/**
 * One badge vocabulary across every screen: published is green wherever it
 * appears, a suspended account and a failed charge share the same red.
 */
export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn(toneClass[tone], className)}>
      {children}
    </Badge>
  );
}

/** draft / published, as both content tables render it. */
export function ContentStatusBadge({ status }: { status: string }) {
  return (
    <StatusBadge tone={status === "published" ? "success" : "neutral"}>
      {status}
    </StatusBadge>
  );
}
