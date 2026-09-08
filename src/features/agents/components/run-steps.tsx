"use client";

import { Fragment, useState } from "react";
import { ChevronRight } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCredits, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AgentRunStep } from "../service/agents.service";

/**
 * How much of one field is shown before the raw value has to be opened, and how
 * much of the raw value is shown at all. Tool output carries a fetched page or
 * the text of a scanned document; pasting all of it into the table would bury
 * the two lines that say what went wrong.
 */
const FIELD_LIMIT = 800;
const RAW_LIMIT = 20_000;

interface Clamped {
  text: string;
  /** Characters dropped. Always said out loud — a value silently cut reads as the whole value. */
  cut: number;
}

function clamp(text: string, limit: number): Clamped {
  if (text.length <= limit) return { text, cut: 0 };
  return { text: text.slice(0, limit), cut: text.length - limit };
}

/**
 * One field as text.
 *
 * Everything in here came out of a tool — a web page, a model's answer, the OCR
 * of somebody's upload — so it is rendered as a string and nothing else. It is
 * never handed to `AnswerBody`: that renders markdown, which would let a link or
 * an image inside a fetched page draw itself on this page.
 */
function asText(value: unknown): string {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return String(value);
  if (typeof value === "object") return JSON.stringify(value, null, 2) ?? "";
  return String(value);
}

function CutNotice({ cut }: { cut: number }) {
  return (
    <span className="text-muted-foreground">
      {" "}
      … {formatNumber(cut)} more characters, not shown
    </span>
  );
}

/**
 * What a step was given, or what it produced.
 *
 * The readable half is the top-level fields, because that is where a tool puts
 * the thing somebody is looking for — `preview`, `refused`, `fileName`. The raw
 * JSON sits underneath rather than instead of it: a summary alone can hide the
 * one key that mattered, and a `<pre>` alone makes reading the common case work.
 */
function StepValue({
  title,
  value,
  empty,
}: {
  title: string;
  value: Record<string, unknown>;
  empty: string;
}) {
  const [rawOpen, setRawOpen] = useState(false);
  const entries = Object.entries(value);

  if (entries.length === 0) {
    return (
      <div className="space-y-1">
        <h4 className="text-xs font-medium">{title}</h4>
        <p className="text-xs text-muted-foreground">{empty}</p>
      </div>
    );
  }

  const raw = clamp(JSON.stringify(value, null, 2) ?? "", RAW_LIMIT);

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-medium">{title}</h4>

      <dl className="space-y-2">
        {entries.map(([field, fieldValue]) => {
          const shown = clamp(asText(fieldValue), FIELD_LIMIT);
          return (
            <div
              key={field}
              className="grid gap-0.5 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-3"
            >
              <dt className="text-xs text-muted-foreground break-words">
                {field}
              </dt>
              <dd className="text-xs break-words whitespace-pre-wrap">
                {shown.text}
                {shown.cut > 0 && <CutNotice cut={shown.cut} />}
              </dd>
            </div>
          );
        })}
      </dl>

      <Collapsible open={rawOpen} onOpenChange={setRawOpen}>
        <CollapsibleTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-muted-foreground"
          >
            <ChevronRight
              className={cn("transition-transform", rawOpen && "rotate-90")}
            />
            Raw value
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          {/*
            Wrapped rather than scrolled sideways: this sits inside the steps
            table's own horizontal scroller, and a line that does not wrap would
            widen the table until the whole section scrolled.
          */}
          <pre className="mt-1 max-h-80 overflow-y-auto rounded-md border bg-muted/40 p-2 font-mono text-xs break-words whitespace-pre-wrap">
            {raw.text}
            {raw.cut > 0 && <CutNotice cut={raw.cut} />}
          </pre>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

/** running and succeeded are the unremarkable cases and carry no badge. */
function StepStatusBadge({ status }: { status: string }) {
  if (status === "succeeded") return null;
  return (
    <StatusBadge tone={status === "failed" ? "danger" : "info"} className="ml-2">
      {status}
    </StatusBadge>
  );
}

function StepRow({ step }: { step: AgentRunStep }) {
  const [open, setOpen] = useState(false);
  const label = step.name ?? step.kind;
  const detailId = `run-step-${step.id}`;
  // A step and the rows that belong to it read as one block, so the rule goes
  // under the last of them rather than between a step and its own reason.
  const attached = step.status === "failed" || open;

  return (
    <Fragment>
      <TableRow className={cn(attached && "border-0")}>
        <TableCell className="w-8 pr-0">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-expanded={open}
            aria-controls={detailId}
            aria-label={`${open ? "Hide" : "Show"} what step ${step.seq} was given and produced`}
            onClick={() => setOpen((current) => !current)}
          >
            <ChevronRight
              className={cn("transition-transform", open && "rotate-90")}
            />
          </Button>
        </TableCell>
        <TableCell className="tabular-nums">{step.seq}</TableCell>
        <TableCell>
          {label}
          {step.name && (
            <span className="ml-1 text-xs text-muted-foreground">
              {step.kind}
            </span>
          )}
          <StepStatusBadge status={step.status} />
        </TableCell>
        <TableCell className="text-muted-foreground">
          {step.model ? `${step.provider} / ${step.model}` : "—"}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatNumber(step.inputTokens)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatNumber(step.outputTokens)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatCredits(step.credits)}
        </TableCell>
      </TableRow>

      {/*
        A failed step says why without being opened. The reason is the whole
        point of looking at the run, and hiding it behind a toggle is how it
        ended up as an unattributed red line at the top of the page instead.
      */}
      {step.status === "failed" && (
        <TableRow className={cn("hover:bg-transparent", open && "border-0")}>
          <TableCell className="pt-0" />
          <TableCell colSpan={6} className="pt-0 pl-0 whitespace-normal">
            <p className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive break-words whitespace-pre-wrap">
              {step.error ?? "This step failed and recorded no reason."}
            </p>
          </TableCell>
        </TableRow>
      )}

      {open && (
        <TableRow className="hover:bg-transparent">
          <TableCell className="pt-0" />
          <TableCell
            id={detailId}
            colSpan={6}
            className="space-y-4 pt-0 pl-0 align-top whitespace-normal"
          >
            <StepValue
              title="Given"
              value={step.input}
              empty="This step recorded nothing about what it was given."
            />
            <StepValue
              title="Produced"
              value={step.output}
              empty="This step recorded no output."
            />
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}

/**
 * What the run did, step by step, and enough of each step to tell why one of
 * them failed without asking whoever built the flow.
 */
export function RunSteps({ steps }: { steps: AgentRunStep[] }) {
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <TableHead>#</TableHead>
            <TableHead>Step</TableHead>
            <TableHead>Model</TableHead>
            <TableHead className="text-right">In</TableHead>
            <TableHead className="text-right">Out</TableHead>
            <TableHead className="text-right">Credits</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {steps.map((step) => (
            <StepRow key={step.id} step={step} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
