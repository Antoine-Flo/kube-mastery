# Drill Manifest Pre-Validation

## Problem

Drill validation currently runs **after** the user applies a manifest. If the manifest is structurally wrong (missing a required label, wrong `storageClassName`, etc.), the simulator cannot reproduce the exact Kubernetes admission error messages, and the user gets no useful feedback.

Trying to replicate every possible Kubernetes error verbatim is not viable:
- Too many error combinations
- Timing-dependent errors (PV/PVC binding)
- Cross-field validation cascades specific to the real admission controller

## Solution: Block `kubectl apply -f` on manifest shape

Instead of simulating errors after the fact, validate the manifest **before** creating the resource. If the manifest does not meet structural requirements, reject the command immediately with a clear, controlled message.

### What this gives us

- Full control over error messages
- No need to replicate Kubernetes internals
- User gets actionable feedback ("storageClassName must be `manual`")
- Deterministic, testable behavior

## Architecture

### Insertion point

`src/core/kubectl/commands/handlers/internal/apply/entrypoint.ts`

After `parseKubernetesYamlDocuments` succeeds (objects are fully parsed and typed), before `applyResourceWithEvents`. This is the least invasive point.

```
readFile
  -> parseKubernetesYamlDocuments  (YAML + Zod validation)
  -> [NEW] pre-apply policy check   <-- insertion point
  -> applyResourceWithEvents
  -> apiServer.createResource / updateResource
```

### Three options (from simplest to most flexible)

#### Option A: Extend Zod schemas in `yamlParser.ts` (simplest)

For cases where a field is always required regardless of drill context (e.g. a PV always needs `storageClassName`), extend the Zod schemas used by `validateResource`. Rejected manifests produce a clear, controlled message without any new infrastructure.

**Good for:** universal structural rules, missing required fields.
**Not good for:** drill-specific rules (e.g. "value must be exactly `manual` for this exercise").

#### Option B: Drill-injected policy rules in the environment (recommended for drill-specific rules)

The drill seed injects a set of structural constraints into the emulated environment at startup. The `handleApply` function receives a policy port and evaluates constraints before applying.

```typescript
type ManifestPolicy = {
  kind: ResourceKind
  path: string        // jsonpath
  value: string
  onFail: string      // error message shown in terminal
}
```

Zero coupling between the markdown content and the kubectl handler. Rules live in the drill config/seed, evaluated at apply time.

**Good for:** drill-specific value checks, required labels, exact field values.
**Not good for:** universal Zod-level validation.

#### Option C: New assertion type in drill markdown (most expressive, most coupled)

Add a `manifestRequires` assertion type to the `### Validation` YAML blocks. The system evaluates it at apply time, not after.

```yaml
- type: manifestRequires
  kind: PersistentVolume
  path: '{.spec.storageClassName}'
  value: 'manual'
  onFail: "storageClassName must be `manual` to bind with data-pv."
```

Requires passing the active drill context down to the kubectl handler. Creates coupling between the markdown layer and the terminal runtime.

**Good for:** expressive, content-driven rules co-located with the drill.
**Not good for:** clean separation of concerns.

## Recommendation

| Use case | Approach |
|---|---|
| Field always required (structural) | Option A: Zod schema extension |
| Drill-specific value constraint | Option B: Environment policy rules |
| Rich per-step manifest rules | Option C: `manifestRequires` assertion type |

Start with **Option A** for simple cases. Add **Option B** as a lightweight policy layer when drills need to constrain specific values. Reserve **Option C** for later if content-driven rules become necessary.

## Key files

| File | Role |
|---|---|
| `src/core/kubectl/commands/handlers/internal/apply/entrypoint.ts` | Apply flow, insertion point |
| `src/core/kubectl/yamlParser.ts` | YAML parse + Zod validation (Option A) |
| `src/core/kubectl/commands/resourceCatalog.ts` | `applyResourceWithEvents` |
| `src/core/drills/validation/AssertionEngine.ts` | Existing assertion evaluation |
| `src/content/drills/domain.ts` | Drill content parsing |
| `src/components/drills/DrillValidations.astro` | Client-side validation runner |
