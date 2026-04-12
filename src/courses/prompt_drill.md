# KubeMastery Drill Authoring Prompt

## Task design

Task headings state the outcome, not the method. Specify resource name, namespace, and key specs. Never say "write a manifest and apply it" or "generate a manifest". Say "Create a PersistentVolumeClaim named `data-pvc` in namespace `storage-lab` with...".

Every task must change cluster or filesystem state. The result must be assertable.
Read-only commands (`get`, `describe`, `logs`) are only allowed inside a Solution block as diagnostic support before a fix, or as final confirmation. Never as a standalone task.
Merge pure verification steps (only `kubectl get`) into the preceding task's Validation block instead of making them a separate task.

Scenarios are CKA-inspired.

## Solution style

Use `--dry-run=client -o yaml` when an imperative command exists.
Use `kubectl patch` or `kubectl set image` for narrow single-field changes.
When no imperative command exists (PV, PVC), reference the docs page by name (e.g. "Concepts > Storage > Persistent Volumes"). Do not list the fields to modify, they are visible in the YAML example. Never use `cat << 'EOF'` heredocs.
When a generated manifest needs additions (volumeMounts, tolerations...), show only the added keys and say which section they go into.

## Writing style

Task headings: short imperative sentence, specific names and values included.
Explanation after code blocks: one or 2 sentences. Put a link to one of the lessons that explains the concept. Lessons are in the paths https://kubemastery.com/en/courses/common-core/why-replicasets for exemple, full list in /home/af/code/kube-mastery/src/courses/learningPaths

`onFail` messages: explain what is wrong and what to check.

