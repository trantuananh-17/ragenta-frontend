"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * Renders a body the way the marketing site will. It is a preview, not the site's
 * own renderer, so treat differences in spacing as expected — what it is for is
 * catching a broken heading level or an unclosed list before publishing.
 */
export function MarkdownPreview({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  if (!source.trim()) {
    return (
      <p className={cn("text-sm text-muted-foreground", className)}>
        Nothing to preview yet.
      </p>
    );
  }

  return (
    <div
      className={cn(
        "space-y-3 text-sm leading-relaxed [&_a]:underline [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_h1]:text-xl [&_h1]:font-semibold [&_h2]:text-lg [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:ml-4 [&_ol]:list-decimal [&_ul]:list-disc",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{source}</ReactMarkdown>
    </div>
  );
}
