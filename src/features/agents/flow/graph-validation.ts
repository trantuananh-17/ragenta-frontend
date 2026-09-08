import {
  BEGIN_NODE,
  NODE_CATALOGUE,
  OTHERWISE_HANDLE,
  branchesOf,
  casesOf,
  categoriesOf,
  isBranchingNode,
  routesOf,
  type AgentGraph,
  type FlowNode,
} from "./graph-model";

export interface GraphProblem {
  /** "error" is a flow that will not work; "warning" is a judgement call. */
  level: "error" | "warning";
  /**
   * True only for the rules `ragenta-backend` itself refuses at publish time.
   *
   * The two facts are separate on purpose: the backend validates the graph's
   * shape when a version is written but each node's parameters only when that
   * node runs, so an empty prompt is a certain failure that publishing would
   * nevertheless accept. Blocking on it would stop someone saving work in
   * progress; not saying it is an error would understate it.
   */
  blocksPublish: boolean;
  nodeId: string | null;
  message: string;
}

/** Whether Publish should be refused, rather than merely warned about. */
export function hasBlockingProblem(problems: GraphProblem[]): boolean {
  return problems.some((problem) => problem.blocksPublish);
}

/** The longest label the backend's node schema accepts. */
const MAX_LABEL_LENGTH = 80;

/** The ceiling the backend's loop schema puts on one loop node. */
const MAX_LOOP_ITERATIONS = 25;

/**
 * Everything wrong with a flow that can be seen without running it.
 *
 * Mirrors `validateGraph` in `ragenta-backend` for the rules that block a
 * publish, and adds the ones the backend only discovers mid-run — an empty
 * required parameter, a branch wired to nothing — because finding those at the
 * publish button, or worse in a charged run, is the failure this panel exists
 * to prevent.
 */
export function validateFlow(graph: AgentGraph): GraphProblem[] {
  const problems: GraphProblem[] = [];
  const ids = Object.keys(graph.nodes);
  const exists = (id: string) => graph.nodes[id] !== undefined;

  const begin = graph.nodes[BEGIN_NODE];
  if (!begin) {
    problems.push(blocking(null, "This flow has no start step."));
  } else if (begin.type !== "begin") {
    problems.push(blocking(BEGIN_NODE, "The step called `begin` must be the start step."));
  }

  const begins = ids.filter((id) => graph.nodes[id]?.type === "begin");
  if (begins.length > 1) {
    problems.push(blocking(null, "A flow has exactly one start step."));
  }

  for (const [id, node] of Object.entries(graph.nodes)) {
    const name = nameOf(id, node);

    for (const target of node.downstream) {
      if (!exists(target)) {
        problems.push(blocking(id, `"${name}" leads to "${target}", which is not in the flow.`));
      }
    }
    for (const source of node.upstream) {
      if (!exists(source)) {
        problems.push(
          blocking(id, `"${name}" takes its input from "${source}", which is not in the flow.`),
        );
      }
    }
    for (const target of node.onError?.goto ?? []) {
      if (!exists(target)) {
        problems.push(
          blocking(id, `"${name}" fails over to "${target}", which is not in the flow.`),
        );
      }
    }

    if (id !== BEGIN_NODE && node.upstream.length === 0) {
      problems.push(blocking(id, `Nothing leads to "${name}".`));
    }

    if (node.label.length > MAX_LABEL_LENGTH) {
      problems.push(
        blocking(id, `The name of "${name}" is longer than ${MAX_LABEL_LENGTH} characters.`),
      );
    }

    if (isBranchingNode(node.type)) {
      for (const branch of branchesOf(node)) {
        for (const target of branch.targets) {
          if (!exists(target)) {
            problems.push(
              error(
                id,
                `Branch "${branch.label}" of "${name}" points at "${target}", which is not in the flow.`,
              ),
            );
          }
        }
        if (branch.targets.length === 0 && branch.handle !== OTHERWISE_HANDLE) {
          problems.push(error(id, `Branch "${branch.label}" of "${name}" goes nowhere.`));
        }
      }
    }

    if (node.type === "loop") {
      problems.push(...loopProblems(graph, id, name, node));
    }

    problems.push(...paramProblems(id, name, node));
  }

  const reachable = reachableFrom(graph);
  for (const id of ids) {
    const node = graph.nodes[id]!;
    // A node nothing leads to is already reported, and more precisely.
    if (id === BEGIN_NODE || node.upstream.length === 0) continue;
    if (!reachable.has(id)) {
      problems.push(
        warning(id, `"${nameOf(id, node)}" cannot be reached from the start step.`),
      );
    }
  }

  for (const [from, to] of backEdges(graph)) {
    problems.push(
      warning(
        from,
        `"${nameOf(from, graph.nodes[from]!)}" leads back to "${nameOf(to, graph.nodes[to]!)}". A loop is allowed, but a run stops itself after a fixed number of steps — check that something ends it.`,
      ),
    );
  }

  return problems;
}

function nameOf(id: string, node: FlowNode): string {
  return node.label || NODE_CATALOGUE[node.type]?.title || id;
}

function blocking(nodeId: string | null, message: string): GraphProblem {
  return { level: "error", blocksPublish: true, nodeId, message };
}

function error(nodeId: string | null, message: string): GraphProblem {
  return { level: "error", blocksPublish: false, nodeId, message };
}

function warning(nodeId: string | null, message: string): GraphProblem {
  return { level: "warning", blocksPublish: false, nodeId, message };
}

function text(node: FlowNode, key: string): string {
  const value = node.params[key];
  return typeof value === "string" ? value.trim() : "";
}

/**
 * A loop's body, checked as the edge the backend treats it as.
 *
 * `body` is the one parameter that names another node, so `validateGraph`
 * checks it when a version is written rather than when the node runs — every
 * rule below therefore blocks a publish. They exist because the engine runs the
 * body itself, once per item, and takes it out of what the frontier picks up
 * next: a body something else also leads to runs twice and is charged twice, a
 * body with its own downstream has a branch that silently never runs, a body
 * that stops to ask a person cannot be resumed part-way through a list, and a
 * loop inside a loop multiplies a budget nobody looked at.
 */
function loopProblems(
  graph: AgentGraph,
  id: string,
  name: string,
  node: FlowNode,
): GraphProblem[] {
  const bodyId = text(node, "body");
  if (!bodyId) {
    return [blocking(id, `"${name}" is a loop, so it needs a step to run for each item.`)];
  }

  if (bodyId === id) {
    return [blocking(id, `"${name}" cannot be its own loop body.`)];
  }

  const body = graph.nodes[bodyId];
  if (!body) {
    return [blocking(id, `"${name}" loops over "${bodyId}", which is not in the flow.`)];
  }

  const problems: GraphProblem[] = [];
  const bodyName = nameOf(bodyId, body);

  if (!node.downstream.includes(bodyId)) {
    problems.push(blocking(id, `"${name}" loops over "${bodyName}" but does not lead to it.`));
  }
  if (body.upstream.length !== 1 || body.upstream[0] !== id) {
    problems.push(
      blocking(id, `"${name}" must be the only step leading to its loop body "${bodyName}".`),
    );
  }
  if (body.downstream.length > 0) {
    problems.push(
      blocking(
        id,
        `Nothing runs after the loop body "${bodyName}" — put what comes next after "${name}" instead.`,
      ),
    );
  }
  if (body.type === "loop") {
    problems.push(
      blocking(id, `"${bodyName}" cannot be a loop body: a loop inside a loop is not supported.`),
    );
  }
  if (body.type === "user_input") {
    problems.push(
      blocking(
        id,
        `"${bodyName}" cannot be a loop body: a run that stops to ask a person cannot be resumed part-way through a list.`,
      ),
    );
  }

  return problems;
}

/**
 * Required parameters, per type.
 *
 * These mirror the backend's per-node schemas, which are parsed when the node
 * executes. A missing one is therefore a run that fails after the steps before
 * it have already been paid for — an error worth showing, and not one that
 * stops the version being saved.
 */
function paramProblems(id: string, name: string, node: FlowNode): GraphProblem[] {
  const problems: GraphProblem[] = [];
  const required = (key: string, label: string) => {
    if (!text(node, key)) problems.push(error(id, `"${name}" has no ${label}.`));
  };

  switch (node.type) {
    case "llm":
      required("prompt", "prompt");
      break;

    case "agent": {
      required("prompt", "prompt");
      const rounds = Number(node.params.maxRounds ?? 3);
      if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10) {
        problems.push(error(id, `"${name}" allows a number of rounds outside 1 to 10.`));
      }
      break;
    }

    case "knowledge_search": {
      required("query", "search query");
      const topK = node.params.topK;
      if (topK !== undefined && topK !== null) {
        const count = Number(topK);
        if (!Number.isInteger(count) || count < 1 || count > 20) {
          problems.push(error(id, `"${name}" asks for a number of passages outside 1 to 20.`));
        }
      }
      break;
    }

    case "message":
      required("text", "text");
      break;

    case "user_input": {
      required("prompt", "question");
      const fields = (node.params.fields as string[] | undefined) ?? [];
      if (fields.length < 1 || fields.length > 6) {
        problems.push(error(id, `"${name}" needs between one and six answer fields.`));
      }
      if (fields.some((field) => field.trim() === "")) {
        problems.push(error(id, `"${name}" has an answer field with no name.`));
      }
      break;
    }

    case "categorize": {
      required("input", "text to classify");
      const categories = categoriesOf(node);
      if (categories.length < 2 || categories.length > 8) {
        problems.push(error(id, `"${name}" needs between two and eight categories.`));
      }
      if (categories.some((category) => category.name.trim() === "")) {
        problems.push(error(id, `"${name}" has a category with no name.`));
      }
      break;
    }

    case "switch": {
      const cases = casesOf(node);
      if (cases.length < 1 || cases.length > 8) {
        problems.push(error(id, `"${name}" needs between one and eight conditions.`));
      }
      cases.forEach((branch, index) => {
        if (branch.left.trim() === "") {
          problems.push(
            warning(id, `Condition ${index + 1} of "${name}" compares an empty value.`),
          );
        }
      });
      break;
    }

    case "http":
    case "browser":
      required("url", "address to call");
      break;

    case "ocr":
    case "stt":
      required("attachmentId", "attachment to read");
      break;

    case "vision":
      required("attachmentId", "attachment to look at");
      required("question", "question");
      break;

    case "tts":
      required("text", "text to speak");
      break;

    case "excel": {
      if (node.params.operation === "write") {
        /*
          Either source will do, and neither is the case worth catching: a write
          with nothing to write publishes happily and produces a workbook holding
          one empty cell, which reads as the step having run.
        */
        const rows = String(node.params.rows ?? "").trim();
        const sheets = (node.params.sheets as unknown[] | undefined) ?? [];
        if (rows.length === 0 && sheets.length === 0) {
          problems.push(
            error(id, `"${name}" has no rows to write. Point it at an earlier step's output.`),
          );
        }
      } else {
        required("attachmentId", "workbook to read");
      }
      break;
    }

    case "loop": {
      // Blocking, unlike every other required param here, because the backend
      // parses a loop's params as the *first* step of its publish check — a
      // failure there is reported as a structural problem and refuses the
      // version. Marking these advisory would tell someone their flow publishes
      // and then hand them a 400 with a message about a body node.
      if (typeof node.params.items !== "string" || node.params.items.trim().length === 0) {
        problems.push(blocking(id, `"${name}" has no list to repeat over.`));
      }
      const iterations = Number(node.params.maxIterations ?? 10);
      if (!Number.isInteger(iterations) || iterations < 1 || iterations > MAX_LOOP_ITERATIONS) {
        problems.push(
          blocking(id, `"${name}" repeats a number of times outside 1 to ${MAX_LOOP_ITERATIONS}.`),
        );
      }
      break;
    }

    default:
      break;
  }

  return problems;
}

function reachableFrom(graph: AgentGraph): Set<string> {
  const reachable = new Set<string>();
  if (!graph.nodes[BEGIN_NODE]) return reachable;

  const queue = [BEGIN_NODE];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    for (const target of routesOf(graph, id)) {
      if (graph.nodes[target] && !reachable.has(target)) queue.push(target);
    }
  }

  return reachable;
}

/** Every edge that closes a loop, as `[from, to]`. */
function backEdges(graph: AgentGraph): [string, string][] {
  const onStack = new Set<string>();
  const visited = new Set<string>();
  const found: [string, string][] = [];

  const visit = (id: string) => {
    visited.add(id);
    onStack.add(id);
    for (const target of routesOf(graph, id)) {
      if (!graph.nodes[target]) continue;
      if (onStack.has(target)) found.push([id, target]);
      else if (!visited.has(target)) visit(target);
    }
    onStack.delete(id);
  };

  for (const id of Object.keys(graph.nodes)) {
    if (!visited.has(id)) visit(id);
  }

  return found;
}
