# KubeMastery Drill Authoring Prompt

## Task design

State the outcome, not the method.
Always include resource name, namespace, and key specs.
Do not write "write a manifest" or "generate a manifest" in task titles.
Each task must change cluster or filesystem state.
Each result must be assertable.
`get`, `describe`, `logs` are support commands only.
Never make a read-only command a standalone task.
Merge pure checks into the previous task validation.
Scenarios are CKA-inspired.

## Solution style

Use short, direct sentences.
Use `--dry-run=client -o yaml` when an imperative command exists.
Use `kubectl patch` or `kubectl set image` for narrow updates.
When no imperative command exists (PV, PVC), reference the docs page by name.
Never use `cat << 'EOF'` heredocs.

If a correction needs YAML, always show both:
1. The fast kubectl command that generates a base YAML.
2. The final full manifest, ready to copy/paste and apply.

Do not show partial snippets only.
Show the exact final YAML that must work as-is.

## Writing style

Task headings are short imperative sentences.
Always include concrete names and values.

Add a lesson link for concept recall using an HTML anchor that opens in a new tab, not a bare URL. Use `target="_blank"` and `rel="noopener noreferrer"` on the `<a>` tag.
Example: `<a href="https://kubemastery.com/en/courses/common-core/why-replicasets" target="_blank" rel="noopener noreferrer">Why ReplicaSets</a>`
Lesson list: `/home/af/code/kube-mastery/src/courses/learningPaths`
`onFail` must state what is wrong and what to check.

## Simulator shell constraints

KubeMastery drills run in a constrained simulator shell.
Use only supported shell patterns in solutions and hints.

Supported:
- pipes (`|`)
- simple chaining with `&&`
- built-ins: `pwd`, `cd`, `ls`, `cat`, `grep`, `wc -l`, `nano`, `touch`, `mkdir`, `rm`, `echo` (`>` and `>>`), `env`, `clear`, `sleep`, `nslookup`, `curl`

Not supported:
- `||`
- `;`
- command substitution (`$(...)`, backticks)
- loops and here-documents

