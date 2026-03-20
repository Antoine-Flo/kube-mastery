# Kubectl Handler Internal Architecture

Each command handler follows a two-layer structure:

- `handlers/<command>.ts`, public facade, stable import surface.
- `handlers/internal/<command>/`, command internals, split by responsibility.

## Recommended module layout

- `entrypoint.ts`, orchestration only.
- `types.ts`, local interfaces and type aliases.
- `filters.ts`, pure query and selection helpers.
- `structuredOutput.ts`, json, yaml, jsonpath payload helpers.
- `tableRendering.ts`, table and wide rendering.
- `errors.ts`, command-specific error message builders.
- `resourceHandlers.ts`, declarative resource registry, no `any`.

## Rules

- Keep facades minimal and stable.
- Keep business helpers pure.
- Preserve output parity before optimization.
- Add or update regression tests for output shape and messages.
