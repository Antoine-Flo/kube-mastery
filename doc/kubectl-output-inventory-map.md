# kubectl output: simulation file → upstream reference

Map from TypeScript entry points to primary files in `refs/k8s/kubectl/`. Update this table when adding commands or moving modules.

| Simulation path                                                                                                                 | Primary refs path                                             |
| ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `src/core/kubectl/describe/**` (registry, describers, internal helpers)                                                         | `refs/k8s/kubectl/pkg/describe/`                              |
| `src/core/kubectl/describe/describers/describe*.ts` (one file per kind or small group, no barrel)                               | Same as `pkg/describe` (per-kind describers)                  |
| `src/core/kubectl/formatters/describeHelpers.ts`                                                                                | Shared key/section helpers for describe text                  |
| `src/core/kubectl/printers/describeTabWriter.ts`, `terminalEscape.ts`                                                           | `pkg/describe` tabbedString + cli-runtime `WriteEscaped`      |
| `src/core/kubectl/commands/output/statefulTabWriter.ts`                                                                         | `refs/k8s/kubectl/pkg/cmd/get/table_printer.go`               |
| `src/core/kubectl/commands/handlers/internal/get/` (entrypoint, `structuredOutput.ts`, `tableRendering.ts`, `getPrintFlags.ts`) | `refs/k8s/kubectl/pkg/cmd/get/` (`get.go`, `get_flags.go`, …) |
| `src/core/kubectl/commands/output/` (jsonpath, custom columns, shapers)                                                         | cli-runtime printers via kubectl `get`                        |
| `src/core/kubectl/commands/handlers/logs.ts`                                                                                    | `refs/k8s/kubectl/pkg/cmd/logs/`                              |
| `src/core/kubectl/commands/handlers/version.ts`, `commands/output/versionOutput.ts`                                             | `refs/k8s/kubectl/pkg/cmd/version/`                           |
| `src/core/kubectl/commands/handlers/clusterInfo.ts`                                                                             | `refs/k8s/kubectl/pkg/cmd/clusterinfo/`                       |
| `src/core/kubectl/commands/handlers/internal/apiResources/`                                                                     | `refs/k8s/kubectl/pkg/cmd/apiresources/`                      |
| `src/core/kubectl/commands/handlers/rollout.ts`                                                                                 | `refs/k8s/kubectl/pkg/cmd/rollout/`                           |
| `src/core/kubectl/commands/handlers/explain.ts`                                                                                 | `refs/k8s/kubectl/pkg/cmd/explain/`                           |
