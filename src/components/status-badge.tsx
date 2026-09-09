import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Tone = "neutral" | "success" | "warning" | "danger" | "info";

/**
 * One badge vocabulary across every screen: published is green wherever it
 * appears, a suspended account and a failed charge share the same red.
 *
 * Each tone is one status token used three ways — the text, a 10% wash behind
 * it, a 25% edge. The token is already defined at the right lightness for its
 * own theme, so none of these needs a `dark:` counterpart.
 */
const toneClass: Record<Tone, string> = {
  neutral: "border-transparent bg-muted text-muted-foreground",
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  danger: "border-destructive/25 bg-destructive/10 text-destructive",
  info: "border-info/25 bg-info/10 text-info",
};

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
