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
  useReactFlow,
  type Connection,
  type EdgeChange,
  type NodeChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GripVertical, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ErrorPolicyFields } from "./error-policy";
import { FlowNodeBox } from "./flow-node";
import { NodeParams } from "./node-params";
import { ValidationPanel } from "./validation-panel";
import { hasBlockingProblem, validateFlow } from "./graph-validation";
import {
  NODE_CATALOGUE,
  NODE_TYPES,
  OTHERWISE_HANDLE,
  addNodeToGraph,
  fromCanvas,
  removeNodeFromGraph,
  setNodeParams,
  toCanvas,
  type AgentGraph,
  type FlowNodeType,
} from "./graph-model";

const nodeTypes = { agentNode: FlowNodeBox };

/** Private to this editor: what a palette button hands the canvas on drop. */
const NODE_DRAG_TYPE = "application/x-ragenta-flow-node";

interface FlowEditorProps {
  /** Needed by the node panel: a file chosen there is uploaded to this workspace. */
  workspaceId: string;
  graph: AgentGraph;
  toolIds: string[];
  disabled?: boolean;
  pending?: boolean;
  onChange: (graph: AgentGraph) => void;
  onPublish: () => void;
}

/**
 * The flow canvas.
 *
 * The graph — not the canvas state — is the thing being edited. Positions and
 * edges are pushed back into it on every change rather than reconciled at save
 * time, so what is on screen and what would be published cannot drift apart
 * while someone is looking at both.
 */
export function FlowEditor(props: FlowEditorProps) {
  // The provider wraps the palette too, because dropping a step at the cursor
  // needs `screenToFlowPosition`, which only exists inside it.
  return (
    <ReactFlowProvider>
      <FlowEditorBody {...props} />
    </ReactFlowProvider>
  );
}

function FlowEditorBody({
  workspaceId,
  graph,
  toolIds,
  disabled,
  pending,
  onChange,
  onPublish,
}: FlowEditorProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();
  /*
    The size React Flow measured for each box, kept here because the DSL has no
    place for it and the library will not remember it on our behalf.

    A node is rendered `visibility: hidden` until it has been measured, and
    `adoptUserNodes` re-reads `measured` from the array we pass on every change
    rather than carrying the previous value forward. Rebuilding that array from
    the graph therefore un-measures every box — which, since measuring is itself
    a node change, is a loop that ends with a canvas that draws its background
    and its controls and none of its steps.
  */
  const [measured, setMeasured] = useState<
    Record<string, { width: number; height: number }>
  >({});

  const canvas = useMemo(() => {
    const built = toCanvas(graph);
    return {
      edges: built.edges,
      nodes: built.nodes.map((node) =>
        measured[node.id] ? { ...node, measured: measured[node.id] } : node,
      ),
    };
  }, [graph, measured]);

  const problems = useMemo(() => validateFlow(graph), [graph]);
  const blocked = hasBlockingProblem(problems);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const next = applyNodeChanges(changes, canvas.nodes);

      setMeasured((current) => {
        let changed = false;
        const updated = { ...current };
        for (const node of next) {
          const size = node.measured;
          if (!size?.width || !size.height) continue;
          const known = current[node.id];
          if (known?.width === size.width && known.height === size.height) continue;
          updated[node.id] = { width: size.width, height: size.height };
          changed = true;
        }
        return changed ? updated : current;
      });

      // A measurement is the library reporting on itself; it says nothing the
      // published flow records, and pushing it back through the graph would
      // mark an untouched draft as edited on mount.
      if (changes.every((change) => change.type === "dimensions")) return;
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
      // A branch routes to exactly one step, so connecting it again moves it
      // rather than adding a second route. `otherwise` is the exception: it is
      // a list of steps.
      const replaces =
        connection.sourceHandle !== null &&
        connection.sourceHandle !== undefined &&
        connection.sourceHandle !== OTHERWISE_HANDLE;
      const base = replaces
        ? canvas.edges.filter(
            (edge) =>
              edge.source !== connection.source ||
              edge.sourceHandle !== connection.sourceHandle,
          )
        : canvas.edges;
      onChange(fromCanvas(graph, canvas.nodes, addEdge(connection, base)));
    },
    [canvas.edges, canvas.nodes, graph, onChange],
  );

  const addNode = (type: FlowNodeType, position: { x: number; y: number } | null) => {
    const added = addNodeToGraph(graph, type, position);
    onChange(added.graph);
    setSelected(added.id);
  };

  const removeNode = (id: string) => {
    onChange(removeNodeFromGraph(graph, id));
    setSelected(null);
  };

  const node = selected ? graph.nodes[selected] : undefined;
  const otherNodes = Object.keys(graph.nodes).filter((id) => id !== selected);

  return (
    <div className="grid gap-4 lg:h-[calc(100vh-19rem)] lg:min-h-[560px] lg:grid-cols-[1fr_320px]">
      <div
        className="h-[560px] overflow-hidden rounded-lg border lg:h-auto lg:min-h-0"
        onDragOver={(event) => {
          if (disabled) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
        }}
        onDrop={(event) => {
          if (disabled) return;
          const dropped = event.dataTransfer.getData(NODE_DRAG_TYPE);
          const type = NODE_TYPES.find((candidate) => candidate === dropped);
          if (!type) return;
          event.preventDefault();
          addNode(
            type,
            screenToFlowPosition({ x: event.clientX, y: event.clientY }),
          );
        }}
      >
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
      </div>

      <div className="space-y-4 lg:min-h-0 lg:overflow-y-auto">
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
                draggable={!disabled}
                className="justify-start"
                title={NODE_CATALOGUE[type].description}
                onDragStart={(event) => {
                  event.dataTransfer.setData(NODE_DRAG_TYPE, type);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onClick={() => addNode(type, null)}
              >
                <GripVertical className="size-3.5 text-muted-foreground" />
                {NODE_CATALOGUE[type].title}
              </Button>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">
            Drag one onto the canvas to place it, or click to drop it beside the
            last step.
          </p>
        </div>

        <ValidationPanel problems={problems} onSelect={setSelected} />

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
                workspaceId={workspaceId}
                graph={graph}
                nodeId={selected}
                node={node}
                toolIds={toolIds}
                disabled={disabled}
                onChange={(params) => onChange(setNodeParams(graph, selected, params))}
              />

              {node.type !== "begin" && (
                <>
                  <Separator />
                  <ErrorPolicyFields
                    policy={node.onError}
                    targets={otherNodes}
                    disabled={disabled}
                    onChange={(onError) =>
                      onChange({
                        nodes: { ...graph.nodes, [selected]: { ...node, onError } },
                      })
                    }
                  />
                </>
              )}
            </>
          )}
        </div>

        <Button
          type="button"
          className="w-full"
          disabled={disabled || pending || blocked}
          onClick={onPublish}
        >
          {pending ? "Publishing…" : "Publish new version"}
        </Button>
      </div>
    </div>
  );
}
