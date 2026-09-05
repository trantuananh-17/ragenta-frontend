"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AlertTriangle } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatCredits } from "@/lib/format";
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

/**
 * One turn.
 *
 * The user's question is a bubble on the right, the answer is full width on the
 * left — an answer carrying citations, tables and code needs the room, and a
 * bubble around it only makes it narrower.
 */
export function ChatMessage({ message }: { message: Message }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary px-4 py-2.5 text-sm whitespace-pre-wrap text-primary-foreground">
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

      {message.model && (
        <p className="pt-1 text-[11px] text-muted-foreground tabular-nums">
          {message.model} · {formatCredits(Math.round(message.credits))} credits
        </p>
      )}
    </div>
  );
}

/** The answer as it arrives. Same renderer, so nothing shifts when it settles. */
export function StreamingMessage({
  content,
  citations,
}: {
  content: string;
  citations: Citation[];
}) {
  return (
    <div className="space-y-1">
      {content ? (
        <AnswerBody content={content} citations={citations} />
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="size-2 animate-pulse rounded-full bg-primary" />
          {citations.length > 0
            ? `Reading ${citations.length} passages...`
            : "Searching your documents..."}
        </div>
      )}
    </div>
  );
}
