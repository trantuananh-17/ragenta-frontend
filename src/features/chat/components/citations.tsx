"use client";

import { Children, Fragment, isValidElement, type ReactNode } from "react";
import Link from "next/link";
import { FileText } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { Citation } from "../service/chat.service";

/**
 * The model is asked to cite with [[n]] markers, and the n is the 1-based index
 * of a passage the server froze onto the message. Matching the marker to the
 * passage is therefore exact — no similarity matching after the fact, which is
 * what RAGFlow does and what makes a citation occasionally point at the wrong
 * paragraph.
 */
const MARKER = /\[\[(\d+)\]\]/g;

function CitationBadge({ citation }: { citation: Citation }) {
  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <Link
          href={`#citation-${citation.index}`}
          className="mx-0.5 inline-flex align-baseline no-underline"
        >
          <Badge
            variant="secondary"
            className="h-4 rounded-full px-1.5 text-[10px] font-medium tabular-nums"
          >
            {citation.index}
          </Badge>
        </Link>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-80 space-y-2">
        <p className="flex items-center gap-1.5 text-xs font-medium">
          <FileText className="size-3.5 shrink-0" />
          <span className="truncate">{citation.documentName}</span>
        </p>
        <p className="line-clamp-6 text-xs leading-relaxed text-muted-foreground">
          {citation.snippet}
        </p>
        <p className="text-[10px] text-muted-foreground tabular-nums">
          relevance {citation.score.toFixed(2)}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * Replaces the markers inside already-rendered markdown children.
 *
 * Done on the rendered children rather than on the source text so the markdown
 * itself is never rewritten — substituting HTML into the source before parsing
 * would mean an answer that happens to contain a bracket could inject markup.
 */
export function withCitations(
  children: ReactNode,
  citations: Citation[],
): ReactNode {
  if (citations.length === 0) return children;

  return Children.map(children, (child, childIndex) => {
    if (typeof child !== "string") {
      // Nested markdown elements are rendered by their own component, which
      // applies this in turn — recursing here would double-wrap them.
      return isValidElement(child) ? child : child;
    }

    const parts: ReactNode[] = [];
    let cursor = 0;
    let match: RegExpExecArray | null;
    MARKER.lastIndex = 0;

    while ((match = MARKER.exec(child)) !== null) {
      if (match.index > cursor) parts.push(child.slice(cursor, match.index));
      const citation = citations.find(
        (candidate) => candidate.index === Number(match![1]),
      );
      // A marker with no passage behind it is dropped rather than shown: it
      // would be a footnote pointing at nothing.
      if (citation) {
        parts.push(
          <CitationBadge key={`${childIndex}-${match.index}`} citation={citation} />,
        );
      }
      cursor = match.index + match[0].length;
    }

    if (parts.length === 0) return child;
    if (cursor < child.length) parts.push(child.slice(cursor));
    return <Fragment key={childIndex}>{parts}</Fragment>;
  });
}

/** The full source list under an answer, collapsed until asked for. */
export function SourceList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;

  return (
    <Collapsible className="mt-3 text-xs">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground">
        <FileText className="size-3.5" />
        {citations.length === 1
          ? "1 source"
          : `${citations.length} sources`}
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-2">
        {citations.map((citation) => (
          <div
            key={citation.chunkId}
            id={`citation-${citation.index}`}
            className="rounded-md border bg-background p-2.5"
          >
            <p className="flex items-center gap-1.5 font-medium">
              <Badge
                variant="secondary"
                className="h-4 rounded-full px-1.5 text-[10px] tabular-nums"
              >
                {citation.index}
              </Badge>
              <span className="truncate">{citation.documentName}</span>
            </p>
            <p className="mt-1.5 line-clamp-4 leading-relaxed text-muted-foreground">
              {citation.snippet}
            </p>
          </div>
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
