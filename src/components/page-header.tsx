import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { InfoHint } from "@/components/info-hint";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  back?: { href: string; label: string };
  title: React.ReactNode;
  description?: React.ReactNode;
  /** The longer explanation, shown on hover beside the title. */
  info?: React.ReactNode;
  badges?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * The one page title in the product.
 *
 * List screens reach it through `EntityHeader`, which adds the New button and
 * nothing else; detail and settings screens use it directly. Routing every
 * screen through a single component is what stops a list page, a detail page
 * and a settings page from arriving at three different heading sizes, which is
 * exactly what had happened.
 */
export function PageHeader({
  back,
  title,
  description,
  info,
  badges,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {back && (
        <Link
          href={back.href}
          className="inline-flex w-fit items-center gap-1 rounded-sm text-sm text-muted-foreground hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <ArrowLeft className="size-4" />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <span className="min-w-0 break-words">{title}</span>
            {info && <InfoHint>{info}</InfoHint>}
          </h1>
          {description && (
            <div className="max-w-prose text-sm text-muted-foreground">
              {description}
            </div>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      {badges && <div className="flex flex-wrap items-center gap-2">{badges}</div>}
    </div>
  );
}
