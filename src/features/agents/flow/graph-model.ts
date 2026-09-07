import type { Edge, Node } from "@xyflow/react";

/**
 * The flow DSL, mirroring what `ragenta-backend` validates and executes.
 *
 * Kept as its own type rather than inferred from the canvas library: the graph
 * is what the backend stores and runs, and letting a UI library's node shape be
 * the source of truth would make an upgrade of that library a change to the
 * product's data format.
 */
export const NODE_TYPES = [
  "begin",
  "llm",
  "knowledge_search",
  "agent",
  "categorize",
  "switch",
  "user_input",
  "message",
] as const;

export type FlowNodeType = (typeof NODE_TYPES)[number];

export interface FlowNode {
  type: FlowNodeType;
  label: string;
  params: Record<string, unknown>;
  upstream: string[];
  downstream: string[];
  position: { x: number; y: number } | null;
  onError: {
    retries: number;
    defaultValue: string | null;
    goto: string[];
  } | null;
}

export interface AgentGraph {
  nodes: Record<string, FlowNode>;
}

/** What each node type is called and what it is for, for the palette. */
export const NODE_CATALOGUE: Record<
  FlowNodeType,
  { title: string; description: string; colour: string }
> = {
  begin: {
    title: "Start",
    description: "Where the flow begins. Its output is what the run was asked to do.",
    colour: "var(--color-emerald-500)",
  },
  llm: {
    title: "Model",
    description: "One call to the model with a prompt you write.",
    colour: "var(--color-violet-500)",
  },
  knowledge_search: {
    title: "Search",
    description: "Retrieve passages from the agent's knowledge bases.",
    colour: "var(--color-sky-500)",
  },
  agent: {
    title: "Agent",
    description: "A tool-using agent as one step. It decides what to do, in rounds.",
    colour: "var(--color-amber-500)",
  },
  categorize: {
    title: "Classify",
    description: "Ask the model which branch to take.",
    colour: "var(--color-pink-500)",
  },
  switch: {
    title: "Condition",
    description: "Take a branch by comparing values. The first match wins.",
    colour: "var(--color-orange-500)",
  },
  user_input: {
    title: "Ask a person",
    description: "Pause the run until someone answers. It may wait for days.",
    colour: "var(--color-rose-500)",
  },
  message: {
    title: "Message",
    description: "Say something to whoever is watching. Costs nothing.",
    colour: "var(--color-slate-500)",
  },
};

/** A new flow: just the entry point, so the canvas is never blank. */
export function emptyGraph(): AgentGraph {
  return {
    nodes: {
      begin: {
        type: "begin",
        label: "Start",
        params: {},
        upstream: [],
        downstream: [],
        position: { x: 80, y: 160 },
        onError: null,
      },
    },
  };
}

/**
 * The DSL as the canvas draws it.
 *
 * Edges are derived from `downstream` alone — `upstream` is the same fact from
 * the other side, so reading both would draw every edge twice.
 */
export function toCanvas(graph: AgentGraph): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = Object.entries(graph.nodes).map(([id, node], index) => ({
    id,
    type: "agentNode",
    position: node.position ?? { x: 120 + index * 40, y: 120 + index * 90 },
    data: { label: node.label || id, nodeType: node.type },
  }));

  const edges: Edge[] = [];
  for (const [id, node] of Object.entries(graph.nodes)) {
    for (const target of node.downstream) {
      if (!graph.nodes[target]) continue;
      edges.push({ id: `${id}->${target}`, source: id, target, animated: false });
    }
  }

  return { nodes, edges };
}

/**
 * The canvas back into the DSL.
 *
 * Both directions of every edge are rebuilt here rather than trusted from the
 * previous graph: a node the user deleted would otherwise stay in someone's
 * `upstream` and the backend would refuse to publish a flow that looks fine on
 * screen.
 */
export function fromCanvas(
  graph: AgentGraph,
  nodes: Node[],
  edges: Edge[],
): AgentGraph {
  const next: Record<string, FlowNode> = {};

  for (const node of nodes) {
    const existing = graph.nodes[node.id];
    if (!existing) continue;
    next[node.id] = {
      ...existing,
      label: String((node.data as { label?: string }).label ?? existing.label),
      position: { x: Math.round(node.position.x), y: Math.round(node.position.y) },
      upstream: [],
      downstream: [],
    };
  }

  for (const edge of edges) {
    const source = next[edge.source];
    const target = next[edge.target];
    if (!source || !target) continue;
    if (!source.downstream.includes(edge.target)) source.downstream.push(edge.target);
    if (!target.upstream.includes(edge.source)) target.upstream.push(edge.source);
  }

  return { nodes: next };
}

/** A readable, collision-free id for a node the user just dropped. */
export function newNodeId(graph: AgentGraph, type: FlowNodeType): string {
  let index = 1;
  while (graph.nodes[`${type}_${index}`]) index += 1;
  return `${type}_${index}`;
}

/** The parameters a node of each type starts with, so it is runnable at once. */
export function defaultParams(type: FlowNodeType): Record<string, unknown> {
  switch (type) {
    case "llm":
      return { prompt: "{{begin.text}}", system: "" };
    case "knowledge_search":
      return { query: "{{begin.text}}" };
    case "agent":
      return {
        prompt: "{{begin.text}}",
        system: "",
        tools: ["knowledge_search"],
        maxRounds: 3,
      };
    case "categorize":
      return {
        input: "{{begin.text}}",
        categories: [
          { name: "first", description: "", to: "" },
          { name: "second", description: "", to: "" },
        ],
      };
    case "switch":
      return {
        cases: [{ left: "{{begin.text}}", operator: "contains", right: "", to: "" }],
        otherwise: [],
      };
    case "user_input":
      return { prompt: "Please confirm before this continues.", fields: ["answer"] };
    case "message":
      return { text: "{{begin.text}}" };
    default:
      return {};
  }
}
