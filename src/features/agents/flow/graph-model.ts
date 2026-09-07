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
  "http",
  "ocr",
  "vision",
  "stt",
  "tts",
  "excel",
  "browser",
  "loop",
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

/** The one entry point. Fixed rather than searched for, as the backend has it. */
export const BEGIN_NODE = "begin";

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
  http: {
    title: "HTTP",
    description: "Call an external API. Private address ranges are refused.",
    colour: "var(--color-cyan-500)",
  },
  ocr: {
    title: "Read document",
    description: "Extract text, tables and fields from an attached image.",
    colour: "var(--color-teal-500)",
  },
  vision: {
    title: "Look at image",
    description: "Ask a question about an attached image.",
    colour: "var(--color-teal-500)",
  },
  stt: {
    title: "Transcribe",
    description: "Turn an attached recording into text.",
    colour: "var(--color-indigo-500)",
  },
  tts: {
    title: "Speak",
    description: "Turn text into audio. Its output is the new attachment's id.",
    colour: "var(--color-indigo-500)",
  },
  excel: {
    title: "Spreadsheet",
    description: "Read a workbook, or write one and attach it.",
    colour: "var(--color-lime-600)",
  },
  browser: {
    title: "Browse",
    description: "Read a page through the browser service. Reading only.",
    colour: "var(--color-fuchsia-500)",
  },
  loop: {
    title: "For each",
    description: "Run one step once per item in a list, up to a limit you set.",
    colour: "var(--color-yellow-600)",
  },
};

/**
 * Node types that route through their own params instead of `downstream`.
 *
 * The engine takes the `next` these nodes return and ignores `downstream`
 * entirely, so their `downstream` is kept empty here — see `fromCanvas`.
 */
const BRANCHING_NODE_TYPES: readonly FlowNodeType[] = ["categorize", "switch"];

export function isBranchingNode(type: FlowNodeType): boolean {
  return BRANCHING_NODE_TYPES.includes(type);
}

/** A category as `categorize` stores it. */
export interface CategoryParam {
  name: string;
  description: string;
  to: string;
}

/** A condition as `switch` stores it. */
export interface CaseParam {
  left: string;
  operator: string;
  right: string;
  to: string;
}

export function categoriesOf(node: FlowNode): CategoryParam[] {
  return (node.params.categories as CategoryParam[] | undefined) ?? [];
}

export function casesOf(node: FlowNode): CaseParam[] {
  return (node.params.cases as CaseParam[] | undefined) ?? [];
}

export function otherwiseOf(node: FlowNode): string[] {
  return (node.params.otherwise as string[] | undefined) ?? [];
}

/** The handle a `switch` takes when no case matched. `otherwise` holds a list. */
export const OTHERWISE_HANDLE = "otherwise";

/** How many nodes `switch.otherwise` accepts, as the backend schema has it. */
const MAX_OTHERWISE = 4;

/** One labelled exit of a branching node, and where it currently goes. */
export interface NodeBranch {
  /** The canvas source handle id. Also the key its target is written back to. */
  handle: string;
  label: string;
  targets: string[];
}

const OPERATOR_LABELS: Record<string, string> = {
  equals: "is",
  not_equals: "is not",
  contains: "contains",
  empty: "is empty",
  not_empty: "is not empty",
};

function describeCase(branch: CaseParam, index: number): string {
  const operator = OPERATOR_LABELS[branch.operator] ?? branch.operator;
  if (branch.operator === "empty" || branch.operator === "not_empty") {
    return `${index + 1}. ${operator}`;
  }
  // The label is drawn on the edge as well as in the box, so a long comparison
  // value is cut rather than allowed to cover the canvas.
  const right = branch.right.length > 20 ? `${branch.right.slice(0, 20)}…` : branch.right;
  return `${index + 1}. ${operator} ${right}`.trim();
}

/**
 * The exits a node offers, one per branch for the types that branch.
 *
 * A `categorize` or `switch` node routes through `params.*.to`, so drawing it
 * with a single source handle showed one edge where the graph meant several and
 * gave no way to see where a branch went without opening the settings panel.
 */
export function branchesOf(node: FlowNode): NodeBranch[] {
  if (node.type === "categorize") {
    return categoriesOf(node).map((category, index) => ({
      handle: `category:${index}`,
      label: category.name || `Category ${index + 1}`,
      targets: category.to ? [category.to] : [],
    }));
  }

  if (node.type === "switch") {
    return [
      ...casesOf(node).map((branch, index) => ({
        handle: `case:${index}`,
        label: describeCase(branch, index),
        targets: branch.to ? [branch.to] : [],
      })),
      {
        handle: OTHERWISE_HANDLE,
        label: "Otherwise",
        targets: otherwiseOf(node).slice(0, MAX_OTHERWISE),
      },
    ];
  }

  return [];
}

/** Where a node can send the run: its branches or its `downstream`, plus failover. */
export function routesOf(graph: AgentGraph, id: string): string[] {
  const node = graph.nodes[id];
  if (!node) return [];
  const targets = isBranchingNode(node.type)
    ? branchesOf(node).flatMap((branch) => branch.targets)
    : node.downstream;
  return [...new Set([...targets, ...(node.onError?.goto ?? [])])];
}

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
 * Edges out of an ordinary node are derived from `downstream` alone — `upstream`
 * is the same fact from the other side, so reading both would draw every edge
 * twice. Edges out of a branching node come from its params instead, never from
 * `downstream`, which is the invariant that keeps one branch from becoming two
 * ways to reach the same node.
 */
export function toCanvas(graph: AgentGraph): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = Object.entries(graph.nodes).map(([id, node], index) => ({
    id,
    type: "agentNode",
    position: node.position ?? { x: 120 + index * 40, y: 120 + index * 90 },
    data: {
      label: node.label || id,
      nodeType: node.type,
      branches: branchesOf(node),
    },
  }));

  const edges: Edge[] = [];
  for (const [id, node] of Object.entries(graph.nodes)) {
    if (isBranchingNode(node.type)) {
      for (const branch of branchesOf(node)) {
        for (const target of branch.targets) {
          if (!graph.nodes[target]) continue;
          edges.push({
            id: `${id}:${branch.handle}->${target}`,
            source: id,
            sourceHandle: branch.handle,
            target,
            label: branch.label,
            animated: false,
          });
        }
      }
      continue;
    }

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
 *
 * **How a branch edge is kept out of `downstream`.** An edge leaving a branching
 * node carries the branch's `sourceHandle`, and those edges are written back
 * only into that branch's `to` (or into `otherwise`). A branching node's
 * `downstream` therefore stays empty, so the same route can never be spelled
 * twice. That matters because the engine's frontier marks every `downstream`
 * entry as reached and then runs a node once each reached upstream has finished
 * — a route recorded in both places would reach the target on a branch that was
 * never taken. The target's `upstream` *is* still written, because the backend
 * refuses to publish a node nothing leads to, and because an unreached upstream
 * never blocks the frontier.
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

  const wired = new Map<string, Map<string, string[]>>();

  for (const edge of edges) {
    const source = next[edge.source];
    const target = next[edge.target];
    if (!source || !target) continue;

    if (isBranchingNode(source.type)) {
      const handle = edge.sourceHandle;
      // An edge from a branching node with no handle cannot say which branch it
      // is, and guessing would be the duplicate route this design exists to
      // prevent. The node renders no such handle, so this is unreachable in the
      // canvas and only guards a graph edited by hand.
      if (!handle) continue;
      const byHandle = wired.get(edge.source) ?? new Map<string, string[]>();
      const targets = byHandle.get(handle) ?? [];
      if (!targets.includes(edge.target)) targets.push(edge.target);
      byHandle.set(handle, targets);
      wired.set(edge.source, byHandle);
    } else if (!source.downstream.includes(edge.target)) {
      source.downstream.push(edge.target);
    }

    if (!target.upstream.includes(edge.source)) target.upstream.push(edge.source);
  }

  for (const [id, node] of Object.entries(next)) {
    if (!isBranchingNode(node.type)) continue;

    const merged = new Map<string, string[]>();
    for (const branch of branchesOf(node)) {
      const wiredTargets = wired.get(id)?.get(branch.handle) ?? [];
      // A target that is no longer in the graph draws no edge, so it cannot
      // survive a round trip through the canvas. It is kept rather than quietly
      // dropped so the validation panel can report the dangling branch instead
      // of the flow silently changing shape.
      const dangling = branch.targets.filter((target) => !next[target]);
      merged.set(
        branch.handle,
        branch.handle === OTHERWISE_HANDLE
          ? [...wiredTargets, ...dangling].slice(0, MAX_OTHERWISE)
          : wiredTargets.length > 0
            ? wiredTargets
            : dangling,
      );
    }

    next[id] = withBranchTargets(node, merged);
  }

  return { nodes: next };
}

function withBranchTargets(node: FlowNode, byHandle: Map<string, string[]>): FlowNode {
  if (node.type === "categorize") {
    return {
      ...node,
      params: {
        ...node.params,
        categories: categoriesOf(node).map((category, index) => ({
          ...category,
          to: byHandle.get(`category:${index}`)?.[0] ?? "",
        })),
      },
    };
  }

  if (node.type === "switch") {
    return {
      ...node,
      params: {
        ...node.params,
        cases: casesOf(node).map((branch, index) => ({
          ...branch,
          to: byHandle.get(`case:${index}`)?.[0] ?? "",
        })),
        otherwise: byHandle.get(OTHERWISE_HANDLE) ?? [],
      },
    };
  }

  return node;
}

/** A readable, collision-free id for a node the user just dropped. */
export function newNodeId(graph: AgentGraph, type: FlowNodeType): string {
  let index = 1;
  while (graph.nodes[`${type}_${index}`]) index += 1;
  return `${type}_${index}`;
}

/** Adds a step, at the point it was dropped or stacked beside the last one. */
export function addNodeToGraph(
  graph: AgentGraph,
  type: FlowNodeType,
  position: { x: number; y: number } | null,
): { graph: AgentGraph; id: string } {
  const id = newNodeId(graph, type);
  const count = Object.keys(graph.nodes).length;
  return {
    id,
    graph: {
      nodes: {
        ...graph.nodes,
        [id]: {
          type,
          label: NODE_CATALOGUE[type].title,
          params: defaultParams(type),
          upstream: [],
          downstream: [],
          position: position ?? { x: 320 + (count % 3) * 220, y: 80 + count * 40 },
          onError: null,
        },
      },
    },
  };
}

/**
 * Removes a step and every reference to it.
 *
 * A flow whose edges, branches or failover point at a node that is no longer
 * there is one the backend refuses to publish, and finding that out at the
 * publish button is worse than not creating it.
 */
export function removeNodeFromGraph(graph: AgentGraph, id: string): AgentGraph {
  const nodes: Record<string, FlowNode> = {};
  for (const [candidate, node] of Object.entries(graph.nodes)) {
    if (candidate === id) continue;
    nodes[candidate] = withoutReferencesTo(node, id);
  }
  return { nodes };
}

function withoutReferencesTo(node: FlowNode, removed: string): FlowNode {
  const next: FlowNode = {
    ...node,
    upstream: node.upstream.filter((entry) => entry !== removed),
    downstream: node.downstream.filter((entry) => entry !== removed),
    onError: node.onError
      ? { ...node.onError, goto: node.onError.goto.filter((entry) => entry !== removed) }
      : null,
  };

  if (next.type === "categorize") {
    next.params = {
      ...next.params,
      categories: categoriesOf(next).map((category) =>
        category.to === removed ? { ...category, to: "" } : category,
      ),
    };
  } else if (next.type === "switch") {
    next.params = {
      ...next.params,
      cases: casesOf(next).map((branch) =>
        branch.to === removed ? { ...branch, to: "" } : branch,
      ),
      otherwise: otherwiseOf(next).filter((entry) => entry !== removed),
    };
  }

  return next;
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
    case "http":
      return { url: "", method: "GET", body: "" };
    case "ocr":
      return { attachmentId: "" };
    case "vision":
      return { attachmentId: "", question: "{{begin.text}}" };
    case "stt":
      return { attachmentId: "" };
    case "tts":
      return { text: "{{begin.text}}" };
    case "excel":
      // Reading is the safe default: writing produces a file, and a step that
      // creates something the moment it is dropped on the canvas is a surprise.
      return { operation: "read", attachmentId: "" };
    case "browser":
      return { url: "" };
    case "loop":
      // `body` is empty until the author wires one, and publishing is blocked
      // until they do — the backend refuses a loop whose body is not an edge.
      return { items: "{{begin.text}}", format: "lines", body: "", maxIterations: 10 };
    default:
      return {};
  }
}
