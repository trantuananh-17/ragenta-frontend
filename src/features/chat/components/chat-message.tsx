"use client";

import type { ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle, CircleStop } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  formatCredits,
  formatDateTime,
  formatMessageTime,
} from "@/lib/format";
import { useSmoothText } from "../hooks/smooth-text.hook";
import type { Citation, Message } from "../service/chat.service";
import { MessageAttachments } from "./chat-attachments";
import { SourceList, withCitations } from "./citations";
import { ReadAloudButton } from "./read-aloud";

/**
 * Markdown for an answer.
 *
 * The renderers are explicit rather than inherited from a prose class so the
 * citation substitution can be applied at every place a marker can appear —
 * paragraphs, list items and table cells.
 *
 * Exported because an agent run produces the same thing a chat turn does — an
 * answer carrying `[[n]]` markers over a frozen list of passages — and rendering
 * it twice would let the two drift.
 */
export function AnswerBody({
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
 * When a message was sent, revealed while the cursor is over it.
 *
 * Mounted as the last child of a container carrying `group/message relative`.
 * `absolute` plus `pointer-events-none` is what keeps it out of layout: the
 * transcript must not move a pixel when a cursor crosses it, and a stamp that
 * cannot be hovered cannot trap the pointer either. It hangs into the gap the
 * transcript already leaves under each turn, so it labels the message above it
 * rather than the one below.
 *
 * CSS alone, so there is no per-message state: `group-hover` does the whole job
 * on a pointer, and `group-focus-within` covers a keyboard reaching a link or a
 * control inside the message.
 *
 * Renders nothing when there is no usable timestamp — see `formatMessageTime`
 * for why inventing one is worse than showing none.
 */
function MessageTime({
  at,
  align,
}: {
  at: string;
  /** Which edge of the message the stamp lines up with. */
  align: "left" | "right";
}) {
  const label = formatMessageTime(at);
  if (!label) return null;

  return (
    <time
      dateTime={at}
      title={formatDateTime(at)}
      className={cn(
        "pointer-events-none absolute top-full z-10 mt-px rounded-sm bg-background/90 px-1 text-[10px] leading-none font-medium whitespace-nowrap text-muted-foreground opacity-0 transition-opacity duration-150 select-none group-hover/message:opacity-100 group-focus-within/message:opacity-100 motion-reduce:transition-none",
        // A hover reveal is nothing at all on a touch screen: Tailwind compiles
        // `hover:` inside `@media (hover: hover)`, so a phone would never show a
        // time — and the inline clock this replaced is gone. Where there is no
        // pointer to hover with, the stamp simply stays visible.
        "[@media(hover:none)]:opacity-100",
        // `-ml-1` cancels the stamp's own padding on the answer side, whose
        // block has none of its own — without it the first glyph sits 4px right
        // of the answer's and the left edge of the turn reads as ragged. The
        // question bubble has padding of its own, so there is no edge to match.
        align === "right" ? "right-0" : "-ml-1 left-0",
      )}
    >
      {label}
    </time>
  );
}

/**
 * A stopped answer is not a broken one — it is the length the reader asked for
 * — so it is a note, not a warning. The dashed edge carries the rest: a
 * finished answer and one cut off mid-clause are otherwise the same block of
 * text, and the second reads as a bug in the product.
 */
function StoppedNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex w-fit items-center gap-1.5 rounded-md border border-dashed px-2 py-1 text-xs text-muted-foreground">
      <CircleStop className="size-3.5 shrink-0" />
      {children}
    </p>
  );
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
      <div className="group/message relative flex flex-col items-end gap-2">
        <MessageAttachments attachments={message.attachments} />
        {/*
          An image on its own is a whole question — "what is this?" — so an empty
          bubble under it is suppressed rather than rendered as a coloured sliver.
        */}
        {message.content && (
          <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground">
            {message.content}
          </div>
        )}
        {/*
          On the container rather than on the bubble, because a question that is
          only an image has no bubble to hang under — and `items-end` puts the
          container's right edge exactly where the bubble's already is.
        */}
        <MessageTime at={message.createdAt} align="right" />
      </div>
    );
  }

  const elapsed = elapsedSeconds(message.createdAt, askedAt);

  return (
    // The stamp is a sibling of the answer rather than one of its rows: it is
    // absolutely positioned, and `space-y-1` would still put a margin on it.
    <div className="group/message relative">
      <div className="space-y-1">
        <AnswerBody content={message.content} citations={message.citations} />
        <SourceList citations={message.citations} />

        {message.status === "failed" && (
          <p className="flex items-center gap-1.5 text-xs text-destructive">
            <AlertTriangle className="size-3.5" />
            {message.error ?? "This answer did not complete."}
          </p>
        )}

        {message.status === "stopped" && (
          <StoppedNote>Stopped. What was written is kept.</StoppedNote>
        )}

        <div className="flex items-center gap-1.5 pt-1">
          <ReadAloudButton content={message.content} />
          {/*
            The clock is not on this line any more — it is the hover stamp
            below, which costs the transcript no permanent row. What stays is
            what an instant cannot say: which model answered, what the turn
            cost, and how long it took.
          */}
          {(message.model || elapsed !== null) && (
            <p
              title={answerTitle(message.createdAt, askedAt)}
              className="text-[11px] text-muted-foreground tabular-nums"
            >
              {message.model && (
                <>
                  {message.model} ·{" "}
                  {formatCredits(Math.round(message.credits))} credits
                </>
              )}
              {elapsed !== null && (
                <>
                  {message.model && " · "}
                  {elapsed}s
                </>
              )}
            </p>
          )}
        </div>
      </div>

      <MessageTime at={message.createdAt} align="left" />
    </div>
  );
}

/**
 * What the run is doing, before there is anything to read.
 *
 * The server names two phases and only two, `retrieving` and `generating`, so
 * the waiting state a reader recognises is not a phase of its own: it is
 * `generating` before the first token, and it is `retrieving` on a thread that
 * searches nothing. Each is named separately rather than covered by one
 * spinner, because they are slow for different reasons — retrieval is a vector
 * search and possibly a reranker call, generation is a provider queue — and
 * until the first token this line is the only thing on screen.
 */
function TurnStatus({
  phase,
  citations,
  grounded,
}: {
  phase: "retrieving" | "generating";
  citations: Citation[];
  grounded: boolean;
}) {
  const label =
    phase === "retrieving"
      ? grounded
        ? "Searching your documents..."
        : "Preparing the question..."
      : citations.length > 0
        ? `Reading ${citations.length} passage${citations.length === 1 ? "" : "s"}...`
        : "Writing the answer...";

  return (
    // Announced politely rather than assertively: it is the only sign the turn
    // is alive, but it must not cut across an answer already being read above.
    <p
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 text-sm"
    >
      <span
        aria-hidden
        className="size-2 shrink-0 animate-pulse rounded-full bg-primary motion-reduce:animate-none"
      />
      <span className="text-shimmer inline-block">{label}</span>
    </p>
  );
}

/** The answer as it arrives. Same renderer, so nothing shifts when it settles. */
export function StreamingMessage({
  content,
  citations,
  phase,
  searchedFor,
  grounded,
  live,
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
  /**
   * The stream is still open. False for the moment this answer is still on
   * screen waiting for its saved row to arrive, which is what tells the reveal
   * to stop pacing and show the whole thing.
   */
  live: boolean;
  /** The server has been asked to stop and the last tokens are still arriving. */
  stopping?: boolean;
}) {
  /*
    Paced only while tokens are still arriving, and never once a stop has been
    asked for: someone who asked the answer to end is owed the text that already
    exists, not another second of it being typed out at them. The reveal only
    grows, so neither the stop nor the end of the stream can take words back.

    The shown prefix is what gets parsed, so a half-revealed [[n]] marker is an
    unfinished marker — the same state a half-streamed one is already in, and it
    resolves into a source badge as soon as its closing brackets are revealed.
  */
  const shown = useSmoothText(content, live && !stopping);

  return (
    <div className="space-y-1">
      {shown ? (
        <AnswerBody content={shown} citations={citations} />
      ) : (
        <TurnStatus phase={phase} citations={citations} grounded={grounded} />
      )}

      {/*
        The passages are readable while the answer is still being written, not
        only after it lands — they are frozen by the time they arrive, so the
        list under a streaming answer is the same list as under the saved one.
      */}
      <SourceList citations={citations} />

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
        <StoppedNote>Stopping — keeping what has been written.</StoppedNote>
      )}
    </div>
  );
}
