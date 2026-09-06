"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, CircleStop } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCredits, formatDateTime } from "@/lib/format";
import type { Citation, Message } from "../service/chat.service";
import { SourceList, withCitations } from "./citations";

/**
 * Markdown for an answer.
 *
 * The renderers are explicit rather than inherited from a prose class so the
 * citation substitution can be applied at every place a marker can appear —
 * paragraphs, list items and table cells.
 */
function AnswerBody({
  content,
  citations,
}: {
  content: string;
  citations: Citation[];
}) {
  return (
    <div className="space-y-3 text-sm leading-relaxed break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => <p>{withCitations(children, citations)}</p>,
          li: ({ children }) => (
            <li className="ml-4 list-disc">
              {withCitations(children, citations)}
            </li>
          ),
          ol: ({ children }) => (
            <ol className="ml-4 list-decimal space-y-1">{children}</ol>
          ),
          ul: ({ children }) => <ul className="space-y-1">{children}</ul>,
          td: ({ children }) => (
            <td className="border px-2 py-1 align-top">
              {withCitations(children, citations)}
            </td>
          ),
          th: ({ children }) => (
            <th className="border bg-muted px-2 py-1 text-left font-medium">
              {children}
            </th>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">{children}</table>
            </div>
          ),
          h1: ({ children }) => (
            <h1 className="text-base font-semibold">
              {withCitations(children, citations)}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-sm font-semibold">
              {withCitations(children, citations)}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-medium">
              {withCitations(children, citations)}
            </h3>
          ),
          code: ({ className, children }) =>
            className ? (
              <code className={cn("text-xs", className)}>{children}</code>
            ) : (
              <code className="rounded bg-muted px-1 py-0.5 text-xs">
                {children}
              </code>
            ),
          pre: ({ children }) => (
            <pre className="overflow-x-auto rounded-md border bg-muted p-3 text-xs">
              {children}
            </pre>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {withCitations(children, citations)}
            </a>
          ),
          // Inline marks get their own renderers for one reason: a marker at the
          // end of a bolded sentence is a direct child of `strong`, not of `p`,
          // so without these it survives to the DOM as the literal "[[1]]".
          strong: ({ children }) => (
            <strong className="font-semibold">
              {withCitations(children, citations)}
            </strong>
          ),
          em: ({ children }) => <em>{withCitations(children, citations)}</em>,
          del: ({ children }) => (
            <del className="text-muted-foreground">
              {withCitations(children, citations)}
            </del>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 pl-3 text-muted-foreground">
              {children}
            </blockquote>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/** Wall-clock only: the date is already in the hover title and on the day divider. */
function clockTime(value: string): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * How long the answer took, to one decimal.
 *
 * Null when it cannot be known — the first message of a thread, or a pair whose
 * order the list did not preserve. A wrong duration is worse than none: it would
 * be read as the model being slow.
 */
function elapsedSeconds(answeredAt: string, askedAt?: string): number | null {
  if (!askedAt) return null;
  const ms = new Date(answeredAt).getTime() - new Date(askedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 100) / 10;
}

function answerTitle(answeredAt: string, askedAt?: string): string {
  const elapsed = elapsedSeconds(answeredAt, askedAt);
  const asked = askedAt ? `Asked ${formatDateTime(askedAt)}
` : "";
  const took = elapsed === null ? "" : `
Took ${elapsed}s`;
  return `${asked}Answered ${formatDateTime(answeredAt)}${took}`;
}

/**
 * One turn.
 *
 * The user's question is a bubble on the right, the answer is full width on the
 * left — an answer carrying citations, tables and code needs the room, and a
 * bubble around it only makes it narrower.
 */
export function ChatMessage({
  message,
  askedAt,
}: {
  message: Message;
  /**
   * When the question this answers was sent. Used only for the elapsed time in
   * the hover title — the assistant row is written when the turn ends, so the
   * gap between the two rows is how long the answer took.
   */
  askedAt?: string;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div
          title={`Sent ${formatDateTime(message.createdAt)}`}
          className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground"
        >
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <AnswerBody content={message.content} citations={message.citations} />
      <SourceList citations={message.citations} />

      {message.status === "failed" && (
        <p className="flex items-center gap-1.5 text-xs text-destructive">
          <AlertTriangle className="size-3.5" />
          {message.error ?? "This answer did not complete."}
        </p>
      )}

      {/*
        A stopped answer is not a broken one — it is the length the reader asked
        for — so it is a note, not a warning. Saying so matters: without it a
        sentence that ends mid-clause looks like a bug in the product.
      */}
      {message.status === "stopped" && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CircleStop className="size-3.5" />
          Stopped. What was generated is kept.
        </p>
      )}

      <p
        title={answerTitle(message.createdAt, askedAt)}
        className="pt-1 text-[11px] text-muted-foreground tabular-nums"
      >
        {message.model && (
          <>
            {message.model} · {formatCredits(Math.round(message.credits))}{" "}
            credits ·{" "}
          </>
        )}
        <time dateTime={message.createdAt}>{clockTime(message.createdAt)}</time>
        {elapsedSeconds(message.createdAt, askedAt) !== null && (
          <> · {elapsedSeconds(message.createdAt, askedAt)}s</>
        )}
      </p>
    </div>
  );
}

/** The answer as it arrives. Same renderer, so nothing shifts when it settles. */
export function StreamingMessage({
  content,
  citations,
  phase,
  searchedFor,
  grounded,
  stopping,
}: {
  content: string;
  citations: Citation[];
  /** What the server last said it was doing. */
  phase: "retrieving" | "generating";
  /** The standalone question the server searched for, when it rewrote one. */
  searchedFor?: string | null;
  /** Whether this thread searches anything, so "retrieving" can be named honestly. */
  grounded: boolean;
  /** The server has been asked to stop and the last tokens are still arriving. */
  stopping?: boolean;
}) {
  /*
    Named phases rather than one spinner, because the two halves of a turn fail
    and wait for different reasons: retrieval is a vector search and possibly a
    reranker call that together take seconds on a large base, and until the first
    token there is nothing else on screen to suggest anything is happening.
  */
  const label =
    phase === "retrieving"
      ? grounded
        ? "Searching your documents..."
        : "Preparing the question..."
      : citations.length > 0
        ? `Reading ${citations.length} passages...`
        : "Writing the answer...";

  return (
    <div className="space-y-1">
      {content ? (
        <AnswerBody content={content} citations={citations} />
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          {label}
        </div>
      )}

      {/*
        A rewritten question is shown, not hidden. The rewrite is what retrieval
        actually searched for, and when it misreads the thread that is the only
        explanation on offer for an answer about the wrong subject — the person
        who asked is the only one able to notice.
      */}
      {searchedFor && (
        <p className="text-xs text-muted-foreground">
          Searched for: <span className="italic">{searchedFor}</span>
        </p>
      )}

      {stopping && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <CircleStop className="size-3.5" />
          Stopping — keeping what has been written.
        </p>
      )}
    </div>
  );
}
