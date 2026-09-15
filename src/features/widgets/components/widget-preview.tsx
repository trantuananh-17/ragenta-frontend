import { Send } from "lucide-react";

import { RagentaLogoMark } from "@/components/ragenta-logo";
import { cn } from "@/lib/utils";

/**
 * A still of the embedded chat, drawn from the form's current values.
 *
 * It is deliberately not the real widget: `widget.js` is a self-contained
 * script for other people's pages, and loading it here would mean a live
 * endpoint, a visitor session and credits spent on a preview. A picture is
 * enough to answer the question the form raises — "what will this look like?"
 */
export function WidgetPreview({
  title,
  accentColor,
  greeting,
  quickQuestions,
  placeholder,
  launcherLabel,
  position,
}: {
  title: string;
  accentColor: string;
  greeting: string;
  quickQuestions: string[];
  placeholder: string;
  launcherLabel: string;
  position: "right" | "left";
}) {
  const alignEnd = position === "right";

  return (
    <div className="space-y-2">
      <div className={cn("flex flex-col gap-3", alignEnd ? "items-end" : "items-start")}>
        <div className="flex w-full max-w-[300px] flex-col overflow-hidden rounded-xl border bg-white text-neutral-900 shadow-lg">
          <div
            className="flex items-center gap-2 px-3 py-2.5 text-sm font-semibold text-white"
            style={{ backgroundColor: accentColor }}
          >
            <RagentaLogoMark className="bg-white" style={{ color: accentColor }} />
            <span className="truncate">{title || "Chat"}</span>
          </div>

          <div className="flex min-h-[260px] flex-col gap-2 bg-neutral-50 p-3 text-xs">
            {greeting && (
              <div className="flex items-start gap-2">
                <RagentaLogoMark
                  className="size-5 text-[10px]"
                  style={{ backgroundColor: accentColor }}
                />
                <p className="max-w-[85%] whitespace-pre-line rounded-lg rounded-tl-sm border bg-white px-2.5 py-1.5">
                  {greeting}
                </p>
              </div>
            )}
            {quickQuestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pl-7">
                {quickQuestions.map((question) => (
                  <span
                    key={question}
                    className="rounded-full border bg-white px-2.5 py-1"
                    style={{ borderColor: accentColor, color: accentColor }}
                  >
                    {question}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 border-t px-3 py-2">
            <span className="flex-1 truncate text-xs text-neutral-400">
              {placeholder || "Type a message…"}
            </span>
            <span
              className="flex size-7 items-center justify-center rounded-full text-white"
              style={{ backgroundColor: accentColor }}
            >
              <Send className="size-3.5" />
            </span>
          </div>
          <p className="pb-1.5 text-center text-[10px] text-neutral-400">Powered by Ragenta</p>
        </div>

        <span
          className={cn(
            "flex h-12 items-center gap-2 rounded-full text-sm font-medium text-white shadow-lg",
            launcherLabel ? "pl-2 pr-4" : "w-12 justify-center",
          )}
          style={{ backgroundColor: accentColor }}
        >
          <RagentaLogoMark className="size-8 bg-white" style={{ color: accentColor }} />
          {launcherLabel && <span>{launcherLabel}</span>}
        </span>
      </div>

      <p className="text-xs text-muted-foreground">
        Preview — the real chat animates, streams and remembers the visitor.
      </p>
    </div>
  );
}
