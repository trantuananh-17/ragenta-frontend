"use client";

import { Children, Fragment, type ReactNode } from "react";
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
 * Splits one text run on its markers.
 *
 * The regex is constructed per call rather than shared: a `g` regex carries
 * `lastIndex` as mutable state, and inline elements nest — a `<strong>` inside a
 * paragraph runs this while the paragraph's own loop is still open, and a shared
 * `lastIndex` would make the outer loop resume at the inner one's position and
 * silently drop the rest of the sentence.
 */
function splitMarkers(
  text: string,
  citations: Citation[],
  keyPrefix: string,
): ReactNode {
  const marker = new RegExp(MARKER.source, "g");
  const parts: ReactNode[] = [];
  let cursor = 0;

  for (let match = marker.exec(text); match; match = marker.exec(text)) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index));

    const citation = citations.find(
      (candidate) => candidate.index === Number(match[1]),
    );
    // A marker with no passage behind it is dropped rather than shown: it would
    // be a footnote pointing at nothing.
    if (citation) {
      parts.push(
        <CitationBadge
          key={`${keyPrefix}-${match.index}`}
          citation={citation}
        />,
      );
    }

    cursor = match.index + match[0].length;
  }

  if (parts.length === 0) return text;
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <Fragment key={keyPrefix}>{parts}</Fragment>;
}

/**
 * Replaces the markers inside already-rendered markdown children.
 *
 * Done on the rendered children rather than on the source text so the markdown
 * itself is never rewritten — substituting markup into the source before parsing
 * would mean an answer that happens to contain a bracket could inject markup.
 *
 * Only the direct text runs of the element that calls this are rewritten. A
 * nested element is left alone here and applies this itself, through its own
 * renderer in `chat-message.tsx` — which is what keeps a `[[1]]` inside a code
 * span rendering as the literal text it is, rather than as a footnote.
 */
export function withCitations(
  children: ReactNode,
  citations: Citation[],
): ReactNode {
  if (citations.length === 0) return children;

  return Children.map(children, (child, childIndex) =>
    typeof child === "string"
      ? splitMarkers(child, citations, String(childIndex))
      : child,
  );
}

/** The full source list under an answer, collapsed until asked for. */
export function SourceList({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;

  return (
    <Collapsible className="mt-3 text-xs">
      <CollapsibleTrigger className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground">
        <FileText className="size-3.5" />
        {citations.length === 1 ? "1 source" : `${citations.length} sources`}
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
