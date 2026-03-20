# Internal Handler Template

Copy this folder to start a new command implementation under:

`src/core/kubectl/commands/handlers/internal/<command>/`

Then wire the public facade:

`src/core/kubectl/commands/handlers/<command>.ts`

## Checklist

- Keep entrypoint short, delegate to pure helpers.
- Keep output rendering isolated from filtering logic.
- Keep error builders centralized.
- Add regression tests for:
  - no resources message variants
  - output modes
  - flag combinations
