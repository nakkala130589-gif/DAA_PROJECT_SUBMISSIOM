import assert from "node:assert/strict";
import test from "node:test";

import {
  addEdge,
  backtrackingColoring,
  createPresetGraph,
  createVertex,
  deleteEdge,
  deleteVertex,
  getConflicts,
  getGraphStats,
  greedyColoring,
  isValidColoring,
  PRESETS,
  validateGraph,
  welshPowellColoring,
  type Graph,
} from "./graph-coloring.ts";

test("triangle requires three colors and all algorithms return proper colorings", () => {
  const triangle = createPresetGraph("triangle");
  const greedy = greedyColoring(triangle);
  const welshPowell = welshPowellColoring(triangle);
  const backtracking = backtrackingColoring(triangle, 3);

  assert.equal(greedy.valid, true);
  assert.equal(welshPowell.valid, true);
  assert.equal(backtracking.valid, true);
  assert.equal(greedy.colorsUsed, 3);
  assert.equal(welshPowell.colorsUsed, 3);
  assert.equal(backtracking.colorsUsed, 3);
  for (const run of [greedy, welshPowell, backtracking]) {
    assert.equal(isValidColoring(triangle, run.coloring), true);
  }
});

test("bipartite graph colors with two colors", () => {
  const bipartite = createPresetGraph("complete-bipartite");
  assert.equal(greedyColoring(bipartite).colorsUsed, 2);
  assert.equal(welshPowellColoring(bipartite).colorsUsed, 2);
  assert.equal(backtrackingColoring(bipartite, 2).valid, true);
});

test("complete graph K5 requires five colors", () => {
  const complete = createPresetGraph("complete");
  assert.equal(greedyColoring(complete).colorsUsed, 5);
  assert.equal(welshPowellColoring(complete).colorsUsed, 5);
  assert.equal(backtrackingColoring(complete, 4).solved, false);
  assert.equal(backtrackingColoring(complete, 5).colorsUsed, 5);
});

test("a nonempty edgeless graph uses one color; an empty graph uses none", () => {
  const single = createVertex({ vertices: [], edges: [] }, 100, 100);
  assert.equal(greedyColoring(single).colorsUsed, 1);
  assert.equal(backtrackingColoring(single, 1).colorsUsed, 1);

  const empty = { vertices: [], edges: [] };
  const emptyRun = greedyColoring(empty);
  assert.equal(emptyRun.valid, true);
  assert.equal(emptyRun.colorsUsed, 0);
  assert.equal(emptyRun.message, "Empty graph: no colors are required.");
  assert.equal(backtrackingColoring(empty, 0).valid, true);
});

test("manual same-color neighbors are detected and incomplete colorings are invalid", () => {
  const path = createPresetGraph("path");
  path.vertices[0].color = 2;
  path.vertices[1].color = 2;
  assert.equal(getConflicts(path).length, 1);
  assert.equal(getGraphStats(path).valid, false);
  assert.equal(isValidColoring(path, { v1: 0, v2: 0, v3: 1, v4: 0, v5: 1 }), false);
  assert.equal(isValidColoring(path, { v1: 0, v2: 1, v3: 0, v4: 1, v5: 0 }), true);
});

test("graph editing rejects loops and duplicate edges and cleans up deleted vertices", () => {
  const empty: Graph = { vertices: [], edges: [] };
  const one = createVertex(empty, 20, 40);
  const two = createVertex(one, 80, 40);
  const connected = addEdge(two, "v1", "v2");
  assert.equal(connected.edges.length, 1);
  assert.throws(() => addEdge(connected, "v1", "v1"), /cannot connect to itself/);
  assert.throws(() => addEdge(connected, "v2", "v1"), /already connected/);
  assert.deepEqual(deleteEdge(connected, 0).edges, []);
  assert.deepEqual(deleteVertex(connected, "v1").edges, []);
  assert.throws(() => addEdge(connected, "v1", "missing"), /must exist/);
});

test("graph validation catches dangling, repeated, self, and non-finite data", () => {
  const invalid: Graph = {
    vertices: [
      { id: "v1", label: "A", x: 0, y: 0, color: null },
      { id: "v2", label: "B", x: Number.NaN, y: 10, color: null },
    ],
    edges: [
      { source: "v1", target: "v2" },
      { source: "v2", target: "v1" },
      { source: "v1", target: "v1" },
      { source: "v1", target: "missing" },
    ],
  };
  const validation = validateGraph(invalid);
  assert.equal(validation.valid, false);
  assert.ok(validation.errors.length >= 4);
  assert.equal(isValidColoring(invalid, { v1: 0, v2: 1 }), false);
  assert.throws(() => greedyColoring(invalid), /Invalid graph/);
});

test("all preset chromatic numbers match known results", () => {
  assert.equal(PRESETS.length, 8);
  for (const preset of PRESETS) {
    assert.ok(preset.chromaticNumber && preset.chromaticNumber > 0, `${preset.name} needs a verified value`);
    const runs = [
      greedyColoring(preset.graph),
      welshPowellColoring(preset.graph),
      backtrackingColoring(preset.graph, preset.chromaticNumber),
    ];
    for (const run of runs) {
      assert.equal(run.valid, true, `${preset.name}: ${run.message}`);
      assert.equal(isValidColoring(preset.graph, run.coloring), true, `${preset.name}: invalid assignment`);
      assert.ok(Number.isFinite(run.executionMs) && run.executionMs >= 0);
    }
    if (preset.chromaticNumber > 1) {
      assert.equal(backtrackingColoring(preset.graph, preset.chromaticNumber - 1).solved, false, `${preset.name}`);
    }
  }
});

