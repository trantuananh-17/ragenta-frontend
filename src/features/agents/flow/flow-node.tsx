"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

import { cn } from "@/lib/utils";
import { NODE_CATALOGUE, type FlowNodeType, type NodeBranch } from "./graph-model";

/**
 * One box on the canvas.
 *
 * The type is shown as well as the label because a flow is read by someone who
 * did not write it, and "Triage" alone does not say whether it asks the model or
 * searches the documents.
 *
 * `begin` has no input handle and `message` no output: an entry point with an
 * inbound edge and a terminal node with an outbound one are both flows that
 * cannot be drawn rather than flows that fail at publish.
 *
 * A branching node has one handle per branch rather than one for the node. Its
 * routes live in its params, so a single handle drew one edge where the graph
 * meant several and hid which category went where.
 */
export function FlowNodeBox({ data, selected }: NodeProps) {
  const nodeType = (data as { nodeType: FlowNodeType }).nodeType;
  const label = (data as { label?: string }).label ?? nodeType;
  const branches = (data as { branches?: NodeBranch[] }).branches ?? [];
  const meta = NODE_CATALOGUE[nodeType];
  const running = (data as { running?: boolean }).running === true;
  const done = (data as { done?: boolean }).done === true;

  return (
    <div
      className={cn(
        "min-w-40 max-w-56 rounded-lg border bg-background px-3 py-2 shadow-sm transition-colors",
        selected && "border-primary ring-1 ring-primary/30",
        running && "border-primary bg-primary/5",
        done && !running && "border-emerald-500/40",
      )}
    >
      {nodeType !== "begin" && (
        <Handle type="target" position={Position.Left} className="!size-2" />
      )}

      <div className="flex items-center gap-1.5">
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{ background: meta?.colour }}
        />
        <span className="truncate text-xs font-medium">{label}</span>
      </div>
      <p className="mt-0.5 truncate text-[10px] text-muted-foreground">
        {meta?.title ?? nodeType}
      </p>

      {branches.length > 0 ? (
        // Negative margin so each row reaches the border and the library's own
        // handle offset lands on it, rather than inside the box padding.
        <div className="-mx-3 mt-1.5 space-y-1 border-t px-3 pt-1.5">
          {branches.map((branch) => (
            <div key={branch.handle} className="relative pr-2">
              <span className="block truncate text-[10px] text-muted-foreground">
                {branch.label}
              </span>
              <Handle
                id={branch.handle}
                type="source"
                position={Position.Right}
                className="!size-2"
              />
            </div>
          ))}
        </div>
      ) : (
        nodeType !== "message" && (
          <Handle type="source" position={Position.Right} className="!size-2" />
        )
      )}
    </div>
  );
}
