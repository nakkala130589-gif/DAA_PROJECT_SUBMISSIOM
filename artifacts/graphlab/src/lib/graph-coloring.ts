export type Vertex = {
  id: string;
  label: string;
  x: number;
  y: number;
  color: number | null;
};

export type Edge = {
  source: string;
  target: string;
};

export type Graph = {
  vertices: Vertex[];
  edges: Edge[];
};

export type GraphPreset = {
  id: string;
  name: string;
  description: string;
  expectedProperties: string;
  chromaticNumber?: number;
  graph: Graph;
};

export type AlgorithmStep = {
  colors: Record<string, number>;
  currentVertex?: string;
  neighbors: string[];
  description: string;
  eventType: "try" | "assign" | "backtrack" | "skip" | "complete";
};

export type AlgorithmRun = {
  steps: AlgorithmStep[];
  coloring: Record<string, number>;
  colorsUsed: number;
  valid: boolean;
  executionMs: number;
  solved: boolean;
  message: string;
};

export type GraphStats = {
  vertices: number;
  edges: number;
  density: number;
  colorsUsed: number;
  valid: boolean;
  complete: boolean;
  conflicts: number;
};

export type GraphValidation = {
  valid: boolean;
  errors: string[];
};

const vertex = (id: string, label: string, x: number, y: number): Vertex => ({
  id,
  label,
  x,
  y,
  color: null,
});

const graph = (points: Array<[string, number, number]>, pairs: Array<[number, number]>): Graph => ({
  vertices: points.map(([label, x, y], index) => vertex(`v${index + 1}`, label, x, y)),
  edges: pairs.map(([from, to]) => ({ source: `v${from + 1}`, target: `v${to + 1}` })),
});

const circle = (labels: string[], centerX = 440, centerY = 280, radius = 180) =>
  labels.map((label, index) => {
    const angle = (index / labels.length) * Math.PI * 2 - Math.PI / 2;
    return [label, centerX + Math.cos(angle) * radius, centerY + Math.sin(angle) * radius] as [
      string,
      number,
      number,
    ];
  });

const pairEdges = (pairs: Array<[number, number]>) => pairs;

export const PRESETS: GraphPreset[] = [
  {
    id: "path",
    name: "Path graph",
    description: "A single chain of five vertices. Alternate two colors along the path.",
    expectedProperties: "5 vertices · 4 edges · Bipartite",
    chromaticNumber: 2,
    graph: graph(
      [["A", 170, 280], ["B", 320, 280], ["C", 470, 280], ["D", 620, 280], ["E", 770, 280]],
      pairEdges([[0, 1], [1, 2], [2, 3], [3, 4]]),
    ),
  },
  {
    id: "cycle",
    name: "Cycle graph C₅",
    description: "An odd cycle. Two colors cannot close the loop without a conflict.",
    expectedProperties: "5 vertices · 5 edges · Odd cycle",
    chromaticNumber: 3,
    graph: graph(circle(["A", "B", "C", "D", "E"], 460, 280, 185), pairEdges([[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]])),
  },
  {
    id: "triangle",
    name: "Triangle K₃",
    description: "Every pair of vertices is adjacent, so each needs a distinct color.",
    expectedProperties: "3 vertices · 3 edges · Complete graph",
    chromaticNumber: 3,
    graph: graph([["A", 460, 90], ["B", 285, 410], ["C", 635, 410]], pairEdges([[0, 1], [1, 2], [2, 0]])),
  },
  {
    id: "complete",
    name: "Complete graph K₅",
    description: "Five mutually adjacent vertices; the clique forces five colors.",
    expectedProperties: "5 vertices · 10 edges · Maximum density",
    chromaticNumber: 5,
    graph: graph(circle(["A", "B", "C", "D", "E"], 460, 280, 175), pairEdges([[0, 1], [0, 2], [0, 3], [0, 4], [1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]])),
  },
  {
    id: "bipartite",
    name: "Bipartite graph",
    description: "Two independent groups with cross-group edges only.",
    expectedProperties: "6 vertices · Bipartite",
    chromaticNumber: 2,
    graph: graph(
      [["A", 240, 140], ["B", 240, 280], ["C", 240, 420], ["D", 690, 140], ["E", 690, 280], ["F", 690, 420]],
      pairEdges([[0, 3], [0, 4], [1, 3], [1, 5], [2, 4], [2, 5]]),
    ),
  },
  {
    id: "complete-bipartite",
    name: "Complete bipartite K₃,₃",
    description: "Every vertex on the left connects to every vertex on the right.",
    expectedProperties: "6 vertices · 9 edges · Bipartite",
    chromaticNumber: 2,
    graph: graph(
      [["A", 250, 130], ["B", 250, 280], ["C", 250, 430], ["D", 650, 130], ["E", 650, 280], ["F", 650, 430]],
      pairEdges([[0, 3], [0, 4], [0, 5], [1, 3], [1, 4], [1, 5], [2, 3], [2, 4], [2, 5]]),
    ),
  },
  {
    id: "petersen",
    name: "Petersen graph",
    description: "A classic 3-regular graph that needs three colors despite having no triangles.",
    expectedProperties: "10 vertices · 15 edges · 3-regular",
    chromaticNumber: 3,
    graph: graph(
      [...circle(["A", "B", "C", "D", "E"], 460, 280, 195), ...circle(["F", "G", "H", "I", "J"], 460, 280, 92)],
      pairEdges([
        [0, 1], [1, 2], [2, 3], [3, 4], [4, 0],
        [5, 7], [7, 9], [9, 6], [6, 8], [8, 5],
        [0, 5], [1, 6], [2, 7], [3, 8], [4, 9],
      ]),
    ),
  },
  {
    id: "planar-map",
    name: "Planar map · wheel W₆",
    description: "A center region touches a five-region border; the odd border cycle needs three more.",
    expectedProperties: "6 vertices · 10 edges · Planar graph",
    chromaticNumber: 4,
    graph: graph(
      [["A", 460, 280], ...circle(["B", "C", "D", "E", "F"], 460, 280, 190)],
      pairEdges([[0, 1], [0, 2], [0, 3], [0, 4], [0, 5], [1, 2], [2, 3], [3, 4], [4, 5], [5, 1]]),
    ),
  },
];

export function cloneGraph(source: Graph): Graph {
  return {
    vertices: source.vertices.map((item) => ({ ...item })),
    edges: source.edges.map((item) => ({ ...item })),
  };
}

export function validateGraph(source: Graph): GraphValidation {
  const errors: string[] = [];
  if (!source || !Array.isArray(source.vertices) || !Array.isArray(source.edges)) {
    return { valid: false, errors: ["A graph must have vertex and edge lists."] };
  }
  const ids = new Set<string>();
  const labels = new Set<string>();
  for (const item of source.vertices) {
    if (!item.id || ids.has(item.id)) errors.push(`Vertex IDs must be present and unique (${item.id || "missing ID"}).`);
    if (!item.label || labels.has(item.label)) errors.push(`Vertex labels must be present and unique (${item.label || "missing label"}).`);
    if (!Number.isFinite(item.x) || !Number.isFinite(item.y)) errors.push(`Vertex ${item.label || item.id} must have finite coordinates.`);
    if (item.color !== null && (!Number.isInteger(item.color) || item.color < 0)) errors.push(`Vertex ${item.label || item.id} has an invalid color index.`);
    ids.add(item.id);
    labels.add(item.label);
  }
  const edgeKeys = new Set<string>();
  for (const edge of source.edges) {
    if (!ids.has(edge.source) || !ids.has(edge.target)) {
      errors.push(`Edge ${edge.source}–${edge.target} references a missing vertex.`);
      continue;
    }
    if (edge.source === edge.target) errors.push(`Vertex ${edge.source} cannot connect to itself.`);
    const key = [edge.source, edge.target].sort().join("~");
    if (edgeKeys.has(key)) errors.push(`Edge ${edge.source}–${edge.target} is duplicated.`);
    edgeKeys.add(key);
  }
  return { valid: errors.length === 0, errors };
}

export function createPresetGraph(presetId: string): Graph {
  const preset = PRESETS.find((item) => item.id === presetId);
  if (!preset) throw new Error(`Unknown graph preset: ${presetId}`);
  return cloneGraph(preset.graph);
}

export function createVertex(source: Graph, x = 450, y = 280): Graph {
  const next = cloneGraph(source);
  const usedIds = new Set(next.vertices.map((item) => item.id));
  const usedLabels = new Set(next.vertices.map((item) => item.label));
  let index = next.vertices.length + 1;
  while (usedIds.has(`v${index}`)) index += 1;
  let labelIndex = 0;
  while (labelIndex < 26 && usedLabels.has(String.fromCharCode(65 + labelIndex))) labelIndex += 1;
  let numericLabel = index;
  while (usedLabels.has(`V${numericLabel}`)) numericLabel += 1;
  const label = labelIndex < 26 ? String.fromCharCode(65 + labelIndex) : `V${numericLabel}`;
  next.vertices.push(vertex(`v${index}`, label, x, y));
  return next;
}

export function addEdge(source: Graph, firstId: string, secondId: string): Graph {
  if (firstId === secondId) throw new Error("A vertex cannot connect to itself.");
  const vertices = new Set(source.vertices.map((item) => item.id));
  if (!vertices.has(firstId) || !vertices.has(secondId)) throw new Error("Both selected vertices must exist.");
  if (source.edges.some((item) =>
    (item.source === firstId && item.target === secondId) ||
    (item.source === secondId && item.target === firstId)
  )) throw new Error("Those vertices are already connected.");
  return {
    ...cloneGraph(source),
    edges: [...source.edges, { source: firstId, target: secondId }],
  };
}

export function deleteVertex(source: Graph, vertexId: string): Graph {
  return {
    vertices: source.vertices.filter((item) => item.id !== vertexId).map((item) => ({ ...item })),
    edges: source.edges.filter((item) => item.source !== vertexId && item.target !== vertexId).map((item) => ({ ...item })),
  };
}

export function deleteEdge(source: Graph, edgeIndex: number): Graph {
  if (!Number.isInteger(edgeIndex) || edgeIndex < 0 || edgeIndex >= source.edges.length) return cloneGraph(source);
  return {
    vertices: source.vertices.map((item) => ({ ...item })),
    edges: source.edges.filter((_, index) => index !== edgeIndex).map((item) => ({ ...item })),
  };
}

export function getNeighbors(source: Graph, vertexId: string): string[] {
  const neighbors = new Set<string>();
  for (const edge of source.edges) {
    if (edge.source === vertexId) neighbors.add(edge.target);
    if (edge.target === vertexId) neighbors.add(edge.source);
  }
  return [...neighbors];
}

export function getConflicts(
  source: Graph,
  colors?: Record<string, number | null | undefined>,
): Array<[string, string]> {
  const colorOf = (id: string) => colors ? colors[id] : source.vertices.find((item) => item.id === id)?.color;
  return source.edges
    .filter((edge) => {
      const sourceColor = colorOf(edge.source);
      const targetColor = colorOf(edge.target);
      return sourceColor !== null && sourceColor !== undefined && sourceColor === targetColor;
    })
    .map((edge) => [edge.source, edge.target]);
}

export function isValidColoring(source: Graph, colors: Record<string, number | null | undefined>): boolean {
  if (!validateGraph(source).valid) return false;
  if (source.vertices.some((item) => {
    const color = colors[item.id];
    return color === null || color === undefined || !Number.isInteger(color) || color < 0;
  })) return false;
  return getConflicts(source, colors).length === 0;
}

export function getGraphStats(source: Graph): GraphStats {
  const vertices = source.vertices.length;
  const colors = new Set(source.vertices.flatMap((item) => item.color === null ? [] : [item.color]));
  const complete = source.vertices.every((item) => item.color !== null);
  const conflicts = getConflicts(source).length;
  return {
    vertices,
    edges: source.edges.length,
    density: vertices < 2 ? 0 : source.edges.length / ((vertices * (vertices - 1)) / 2),
    colorsUsed: colors.size,
    valid: validateGraph(source).valid && complete && conflicts === 0,
    complete,
    conflicts,
  };
}

function adjacency(source: Graph): Map<string, string[]> {
  const neighbors = new Map(source.vertices.map((item) => [item.id, [] as string[]]));
  for (const edge of source.edges) {
    neighbors.get(edge.source)?.push(edge.target);
    neighbors.get(edge.target)?.push(edge.source);
  }
  return neighbors;
}

function countColors(colors: Record<string, number>): number {
  return new Set(Object.values(colors)).size;
}

function clock(): number {
  return globalThis.performance?.now?.() ?? Date.now();
}

function snapshot(
  colors: Record<string, number>,
  currentVertex: string | undefined,
  neighbors: string[],
  description: string,
  eventType: AlgorithmStep["eventType"],
): AlgorithmStep {
  return { colors: { ...colors }, currentVertex, neighbors: [...neighbors], description, eventType };
}

function finishRun(
  source: Graph,
  startedAt: number,
  steps: AlgorithmStep[],
  coloring: Record<string, number>,
  solved: boolean,
  message: string,
): AlgorithmRun {
  const valid = solved && isValidColoring(source, coloring);
  return {
    steps,
    coloring: valid ? coloring : {},
    colorsUsed: valid ? countColors(coloring) : 0,
    valid,
    executionMs: Math.round(Math.max(0, clock() - startedAt) * 1000) / 1000,
    solved: valid,
    message,
  };
}

function assertValidGraph(source: Graph): void {
  const validation = validateGraph(source);
  if (!validation.valid) throw new Error(`Invalid graph: ${validation.errors.join(" ")}`);
}

export function greedyColoring(source: Graph): AlgorithmRun {
  assertValidGraph(source);
  const startedAt = clock();
  const neighbors = adjacency(source);
  const colors: Record<string, number> = {};
  const steps: AlgorithmStep[] = [];
  if (source.vertices.length === 0) {
    steps.push(snapshot(colors, undefined, [], "The graph is empty. By convention, its chromatic number is 0.", "complete"));
    return finishRun(source, startedAt, steps, colors, true, "Empty graph: no colors are required.");
  }

  for (const item of source.vertices) {
    const adjacentColors = new Set((neighbors.get(item.id) ?? []).map((id) => colors[id]).filter((color) => color !== undefined));
    let chosenColor = 0;
    while (adjacentColors.has(chosenColor)) chosenColor += 1;
    const blocked = [...adjacentColors].sort((a, b) => a - b).map((color) => `color ${color + 1}`);
    colors[item.id] = chosenColor;
    steps.push(snapshot(
      colors,
      item.id,
      neighbors.get(item.id) ?? [],
      `${item.label} receives color ${chosenColor + 1}, the smallest color not used by its already-colored neighbors${blocked.length ? ` (${blocked.join(", ")} are unavailable)` : ""}.`,
      "assign",
    ));
  }
  steps.push(snapshot(colors, undefined, [], `Done. This vertex order used ${countColors(colors)} color${countColors(colors) === 1 ? "" : "s"}. Greedy coloring is not guaranteed to be minimum.`, "complete"));
  return finishRun(source, startedAt, steps, colors, true, "Every vertex was assigned a color; adjacent vertices have different colors.");
}

export function welshPowellColoring(source: Graph): AlgorithmRun {
  assertValidGraph(source);
  const startedAt = clock();
  const neighbors = adjacency(source);
  const colors: Record<string, number> = {};
  const steps: AlgorithmStep[] = [];
  if (source.vertices.length === 0) {
    steps.push(snapshot(colors, undefined, [], "The graph is empty. By convention, its chromatic number is 0.", "complete"));
    return finishRun(source, startedAt, steps, colors, true, "Empty graph: no colors are required.");
  }

  const order = source.vertices
    .map((item, index) => ({ item, index, degree: neighbors.get(item.id)?.length ?? 0 }))
    .sort((a, b) => b.degree - a.degree || a.index - b.index);
  const orderText = order.map(({ item, degree }) => `${item.label} (${degree})`).join(" → ");
  steps.push(snapshot(colors, undefined, [], `Sort vertices by descending degree: ${orderText}.`, "skip"));

  let remaining = order.map(({ item }) => item);
  let color = 0;
  while (remaining.length > 0) {
    const nextRound: Vertex[] = [];
    let assignedThisRound = 0;
    for (const item of remaining) {
      const blockingNeighbor = (neighbors.get(item.id) ?? []).find((id) => colors[id] === color);
      if (blockingNeighbor) {
        const blocker = source.vertices.find((candidate) => candidate.id === blockingNeighbor)?.label ?? blockingNeighbor;
        steps.push(snapshot(colors, item.id, neighbors.get(item.id) ?? [], `${item.label} cannot join color ${color + 1} because adjacent vertex ${blocker} already has it.`, "skip"));
      } else {
        colors[item.id] = color;
        assignedThisRound += 1;
        steps.push(snapshot(colors, item.id, neighbors.get(item.id) ?? [], `Add ${item.label} to color group ${color + 1}; none of its already assigned neighbors are in this group.`, "assign"));
      }
    }
    for (const item of remaining) if (colors[item.id] === undefined) nextRound.push(item);
    if (assignedThisRound === 0) {
      const item = nextRound.shift();
      if (!item) break;
      colors[item.id] = color;
      steps.push(snapshot(colors, item.id, neighbors.get(item.id) ?? [], `Start color group ${color + 1} with ${item.label}.`, "assign"));
    }
    remaining = nextRound;
    color += 1;
  }

  steps.push(snapshot(colors, undefined, [], `Done. The Welsh–Powell grouping used ${countColors(colors)} color${countColors(colors) === 1 ? "" : "s"}.`, "complete"));
  return finishRun(source, startedAt, steps, colors, true, "All compatible vertices were grouped and properly colored.");
}

export function backtrackingColoring(source: Graph, colorLimit: number): AlgorithmRun {
  assertValidGraph(source);
  const startedAt = clock();
  const limit = Number.isFinite(colorLimit) ? Math.max(0, Math.floor(colorLimit)) : 0;
  const neighbors = adjacency(source);
  const steps: AlgorithmStep[] = [];
  const colors: Record<string, number> = {};
  if (source.vertices.length === 0) {
    steps.push(snapshot(colors, undefined, [], "The graph is empty. By convention, its chromatic number is 0.", "complete"));
    return finishRun(source, startedAt, steps, colors, true, "Empty graph: no colors are required.");
  }
  if (limit === 0) {
    steps.push(snapshot(colors, undefined, [], "A nonempty graph cannot be colored with a limit of zero colors.", "complete"));
    return finishRun(source, startedAt, steps, colors, false, "No solution: a nonempty graph needs at least one color.");
  }

  const order = source.vertices
    .map((item, index) => ({ item, index, degree: neighbors.get(item.id)?.length ?? 0 }))
    .sort((a, b) => b.degree - a.degree || a.index - b.index)
    .map(({ item }) => item);
  steps.push(snapshot(colors, undefined, [], `Try to color every vertex with at most ${limit} color${limit === 1 ? "" : "s"}. Search highest-degree vertices first.`, "try"));

  const search = (index: number, maxColorUsed: number): boolean => {
    if (index === order.length) return true;
    const item = order[index];
    const adjacentIds = neighbors.get(item.id) ?? [];
    const candidates = Math.min(limit, maxColorUsed + 2);
    for (let color = 0; color < candidates; color += 1) {
      const blockingNeighbor = adjacentIds.find((id) => colors[id] === color);
      steps.push(snapshot(colors, item.id, adjacentIds, `Try color ${color + 1} on ${item.label}${blockingNeighbor ? `; checking ${source.vertices.find((candidate) => candidate.id === blockingNeighbor)?.label ?? blockingNeighbor}` : ""}.`, "try"));
      if (blockingNeighbor) {
        const blocker = source.vertices.find((candidate) => candidate.id === blockingNeighbor)?.label ?? blockingNeighbor;
        steps.push(snapshot(colors, item.id, adjacentIds, `Reject color ${color + 1}: adjacent vertex ${blocker} already has that color.`, "backtrack"));
        continue;
      }
      colors[item.id] = color;
      steps.push(snapshot(colors, item.id, adjacentIds, `Assign color ${color + 1} to ${item.label} and continue the search.`, "assign"));
      if (search(index + 1, Math.max(maxColorUsed, color))) return true;
      delete colors[item.id];
      steps.push(snapshot(colors, item.id, adjacentIds, `Backtrack: remove color ${color + 1} from ${item.label} and try another choice.`, "backtrack"));
    }
    return false;
  };

  const solved = search(0, -1);
  if (solved) {
    steps.push(snapshot(colors, undefined, [], `Solution found using ${countColors(colors)} of the ${limit} allowed colors.`, "complete"));
    return finishRun(source, startedAt, steps, colors, true, `A valid coloring was found within the ${limit}-color limit.`);
  }
  steps.push(snapshot(colors, undefined, [], `No coloring exists within the fixed limit of ${limit} color${limit === 1 ? "" : "s"}.`, "complete"));
  return finishRun(source, startedAt, steps, colors, false, `No solution exists within the fixed limit of ${limit} color${limit === 1 ? "" : "s"}.`);
}

