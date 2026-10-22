# GraphLab — complete source workspace

This archive contains the tracked project source, including the GraphLab simulator, graph algorithms and tests, workspace packages, assets, and package manifests. Installed dependencies, build output, Git history, local Replit skill files, and credentials are not included.

## Run

Requires Node.js 24 and pnpm. From this directory, run:

```sh
pnpm install
pnpm --filter @workspace/graphlab run dev
```

## Tests

```sh
pnpm --filter @workspace/graphlab run typecheck
pnpm --filter @workspace/graphlab run test:algorithms
```

The app-specific README is at `artifacts/graphlab/README.md`.
