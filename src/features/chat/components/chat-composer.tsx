"use client";

import { useState } from "react";
import { ArrowUp, Square } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export interface ComposerSubmit {
  content: string;
}

/**
 * The question box.
 *
 * Enter sends and Shift+Enter breaks the line — the convention every chat tool
 * uses, and getting it the other way round is instantly wrong to anyone who has
 * used one. Growth is CSS `field-sizing: content` with a max height, so the box
 * follows the text without a resize observer, and stops before it pushes the
 * answer off the screen.
 */
export function ChatComposer({
  onSubmit,
  onStop,
  pending,
  stopping,
  disabled,
  disabledReason,
  placeholder = "Ask a question about your documents...",
  toolbar,
  autoFocus,
}: {
  onSubmit: (input: ComposerSubmit) => void;
  onStop?: () => void;
  pending?: boolean;
  /** A stop is already in flight; the last tokens are still arriving. */
  stopping?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  placeholder?: string;
  toolbar?: React.ReactNode;
  autoFocus?: boolean;
}) {
  const [value, setValue] = useState("");

  const submit = () => {
    const content = value.trim();
    if (!content || pending || disabled) return;
    setValue("");
    onSubmit({ content });
  };

  return (
    <div
      className={cn(
        "rounded-2xl border bg-background shadow-xs transition-colors",
        "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/20",
        disabled && "opacity-70",
      )}
    >
      <Textarea
        value={value}
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder={disabled ? (disabledReason ?? placeholder) : placeholder}
        rows={1}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
        className="max-h-[220px] min-h-0 resize-none border-0 bg-transparent px-4 py-3 text-sm shadow-none focus-visible:ring-0"
      />

      <div className="flex items-center justify-between gap-2 border-t px-2 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">{toolbar}</div>

        {pending && onStop ? (
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            onClick={onStop}
            disabled={stopping}
            aria-label={stopping ? "Stopping" : "Stop answering"}
          >
            <Square className="size-3.5" />
          </Button>
        ) : (
          <Button
            type="button"
            size="icon-sm"
            onClick={submit}
            disabled={disabled || pending || value.trim().length === 0}
            aria-label="Send"
          >
            <ArrowUp className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
