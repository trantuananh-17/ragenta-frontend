"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { FlowNodeBox } from "./flow-node";
import { NodeParams } from "./node-params";
import {
  NODE_CATALOGUE,
  NODE_TYPES,
  defaultParams,
  fromCanvas,
  newNodeId,
  toCanvas,
  type AgentGraph,
  type FlowNodeType,
} from "./graph-model";

const nodeTypes = { agentNode: FlowNodeBox };

/**
 * The flow canvas.
 *
 * The graph — not the canvas state — is the thing being edited. Positions and
 * edges are pushed back into it on every change rather than reconciled at save
 * time, so what is on screen and what would be published cannot drift apart
 * while someone is looking at both.
 */
export function FlowEditor({
  graph,
  toolIds,
  disabled,
  pending,
  onChange,
  onPublish,
}: {
  graph: AgentGraph;
  toolIds: string[];
  disabled?: boolean;
  pending?: boolean;
  onChange: (graph: AgentGraph) => void;
  onPublish: () => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const canvas = useMemo(() => toCanvas(graph), [graph]);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const next = applyNodeChanges(changes, canvas.nodes);
      onChange(fromCanvas(graph, next, canvas.edges));
    },
    [canvas.edges, canvas.nodes, graph, onChange],
  );

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const next = applyEdgeChanges(changes, canvas.edges);
      onChange(fromCanvas(graph, canvas.nodes, next));
    },
    [canvas.edges, canvas.nodes, graph, onChange],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      const next = addEdge(connection, canvas.edges);
      onChange(fromCanvas(graph, canvas.nodes, next));
    },
    [canvas.edges, canvas.nodes, graph, onChange],
  );

  const addNode = (type: FlowNodeType) => {
    const id = newNodeId(graph, type);
    const count = Object.keys(graph.nodes).length;
    onChange({
      nodes: {
        ...graph.nodes,
        [id]: {
          type,
          label: NODE_CATALOGUE[type].title,
          params: defaultParams(type),
          upstream: [],
          downstream: [],
          position: { x: 320 + (count % 3) * 220, y: 80 + count * 40 },
          onError: null,
        },
      },
    });
    setSelected(id);
  };

  const removeNode = (id: string) => {
    // Every reference to it goes too. A flow whose edges point at a node that is
    // no longer there is one the backend refuses to publish, and finding that out
    // at the publish button is worse than not creating it.
    const nodes = Object.fromEntries(
      Object.entries(graph.nodes)
        .filter(([candidate]) => candidate !== id)
        .map(([candidate, node]) => [
          candidate,
          {
            ...node,
            upstream: node.upstream.filter((entry) => entry !== id),
            downstream: node.downstream.filter((entry) => entry !== id),
          },
        ]),
    );
    onChange({ nodes });
    setSelected(null);
  };

  const node = selected ? graph.nodes[selected] : undefined;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="h-[560px] overflow-hidden rounded-lg border">
        <ReactFlowProvider>
          <ReactFlow
            nodes={canvas.nodes}
            edges={canvas.edges}
            nodeTypes={nodeTypes}
            onNodesChange={disabled ? undefined : onNodesChange}
            onEdgesChange={disabled ? undefined : onEdgesChange}
            onConnect={disabled ? undefined : onConnect}
            onNodeClick={(_event, clicked) => setSelected(clicked.id)}
            onPaneClick={() => setSelected(null)}
            fitView
            proOptions={{ hideAttribution: false }}
          >
            <Background />
            <Controls showInteractive={false} />
          </ReactFlow>
        </ReactFlowProvider>
      </div>

      <div className="space-y-4">
        <div className="space-y-2 rounded-lg border p-3">
          <Label className="text-xs">Add a step</Label>
          <div className="grid grid-cols-2 gap-1.5">
            {NODE_TYPES.filter((type) => type !== "begin").map((type) => (
              <Button
                key={type}
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                className="justify-start"
                title={NODE_CATALOGUE[type].description}
                onClick={() => addNode(type)}
              >
                <Plus className="size-3.5" />
                {NODE_CATALOGUE[type].title}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border p-3">
          {!node || !selected ? (
            <p className="text-xs text-muted-foreground">
              Select a step to configure it. Drag from the right edge of one box to
              the left edge of another to connect them.
            </p>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs">
                  {NODE_CATALOGUE[node.type].title}
                  <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                    {selected}
                  </span>
                </Label>
                {node.type !== "begin" && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={disabled}
                    onClick={() => removeNode(selected)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>

              <Input
                disabled={disabled}
                value={node.label}
                placeholder="Name this step"
                onChange={(event) =>
                  onChange({
                    nodes: {
                      ...graph.nodes,
                      [selected]: { ...node, label: event.target.value },
                    },
                  })
                }
              />

              <Separator />

              <NodeParams
                graph={graph}
                nodeId={selected}
                node={node}
                toolIds={toolIds}
                disabled={disabled}
                onChange={(params) =>
                  onChange({
                    nodes: { ...graph.nodes, [selected]: { ...node, params } },
                  })
                }
              />
            </>
          )}
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={disabled || pending}
          onClick={onPublish}
        >
          {pending ? "Publishing…" : "Publish new version"}
        </Button>
      </div>
    </div>
  );
}
