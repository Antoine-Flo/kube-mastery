# kubectl output: ref-first workflow

This project aligns simulated kubectl output with upstream behavior. Before changing any user-visible formatting:

1. Open the matching path under `refs/k8s/kubectl/` (for example `pkg/cmd/get/` for `kubectl get`, `pkg/describe/` for `kubectl describe`, `pkg/cmd/logs/` for `kubectl logs`).
2. Follow Go `import` lines from that file. If code delegates to `k8s.io/cli-runtime/pkg/printers` or another module, check whether that module is vendored under `refs/`. If it is not, prefer adding the same version to `refs/` for offline reading, or document the gap and rely on kubectl as the consumer of those printers.
3. Treat the Go source in `refs/` as the source of truth for tabs, column order, escaping, and section layout.

Reference: `ai-handoff/kubectl-parity/RUNBOOK.md` (step 2: read reference code in `refs/`).

After changing output or formatter modules, run `npm test` and spot-check with:

`npm run parity:manual -- --no-reset-kind --cmd "kubectl version --client" --cmd "kubectl get ns"`

Expect differences when the kind cluster state or client version string does not match the simulation (normalized AGE and some fields). Use diffs to catch accidental format changes, not as a strict match to kind for every command.
