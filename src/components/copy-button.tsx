"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Copies an opaque string — an id, a webhook URL, a one-time secret, an embed
 * snippet — and says so for 1.5s.
 *
 * Two shapes, one implementation. Without `label` it is an icon beside a value
 * in a table; with one it is a labelled button beside a secret the user has to
 * copy before it disappears, where an unlabelled icon is too quiet for the
 * consequence.
 *
 * Both announce the result through the button's own accessible name rather than
 * a live region: the button holds focus at the moment it changes, so the name
 * change is spoken, and a live region nested inside would also be read as part
 * of that name.
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  /** Renders a labelled button instead of an icon-only one. */
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const copy = async (event: React.MouseEvent) => {
    // Rows are often clickable; copying an id should not also open the row.
    event.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be refused by the browser; the value stays on
      // screen to select by hand, so there is nothing useful to report.
    }
  };

  const Icon = copied ? CheckIcon : CopyIcon;

  if (label) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={className}
        onClick={copy}
      >
        <Icon data-icon="inline-start" />
        {copied ? "Copied" : label}
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-xs"
      aria-label={copied ? "Copied" : "Copy"}
      className={className}
      onClick={copy}
    >
      <Icon />
    </Button>
  );
}
