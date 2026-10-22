# GraphLab

GraphLab is an interactive graph-coloring simulator for learning and experimenting with vertex-coloring algorithms.

## Run the app

From the workspace root:

```sh
pnpm install
pnpm --filter @workspace/graphlab run dev
```

The Replit preview starts the same app through its configured `artifacts/graphlab: web` workflow.

## Run the algorithm tests

```sh
pnpm --filter @workspace/graphlab run test:algorithms
```

The tests cover graph editing, manual coloring conflicts, Greedy, Welsh–Powell, Backtracking, known chromatic numbers for the included presets, and the empty-graph convention.

## Coloring conventions

- Color indices start at zero internally; the interface may display them starting at one.
- A proper coloring assigns every vertex a color and gives adjacent vertices different colors.
- A nonempty graph with no edges uses one color under the positive-color convention.
- The empty graph has chromatic number zero by convention.
- Greedy and Welsh–Powell are heuristics, not minimum-coloring proofs.
- Backtracking searches for a coloring within the user-specified color limit and reports when no solution exists under that limit.

