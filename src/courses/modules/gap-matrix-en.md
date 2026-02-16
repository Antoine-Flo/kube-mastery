# EN Coverage Matrix (Master Plan vs Implemented)

## Snapshot

- Source roadmap: `src/courses/modules/master-plan.md`
- Target structure: `src/courses/kubernetes-full-course/course-structure.ts`
- Current implemented chapters (`chapter.json` present): **40**
- Referenced chapters in complete course roadmap: **95**
- Current gap: **55 chapters**

## Implemented Chapters (EN)

| Module | Implemented chapter count |
|---|---:|
| overview | 8 |
| workloads | 8 |
| services-networking | 4 |
| configuration | 5 |
| security | 6 |
| storage | 3 |
| policy | 2 |
| administration | 3 |
| extend-kubernetes | 3 |

## Next Priority Waves (EN)

### Wave 1 - Core EN (done)

- `overview`: `object-management`, `namespaces`, `labels-intro`, `annotations`, `operations`
- `workloads`: `statefulsets-intro`, `jobs-intro`, `cronjobs`
- `services-networking`: `dns-intro`, `ingress-intro`

### Wave 2 - Configuration + Security intro (done)

- `configuration`: `secrets-intro`, `resource-management-intro`, `probes-intro`, `kubeconfig` (done)
- `security`: `cloud-native-security`, `controlling-api-access`, `service-accounts-intro`, `rbac-intro`, `pod-security-standards`, `linux-security-intro` (done)

### Wave 3 - Advanced expansion (done for first batch)

- `storage`: `volumes-intro`, `pv-pvc-intro`, `storage-class-intro` (done)
- `policy`: `resource-quotas`, `limit-ranges` (done)
- `administration`: `logging`, `observability`, `certificates` (done)
- `extend-kubernetes`: `custom-resources`, `operators`, `kubectl-plugins` (done)

### Next priority after current delivery

- `architecture`: `components-intro`, `nodes`, `control-plane-components`, `controllers-pattern`
- `containers`: `images-container`, `container-environment`, `lifecycle-hooks`
- `workloads` advanced: `deployments-avance`, `statefulsets-avance`, `daemonsets`, `jobs-avance`
- `services-networking` advanced: `services-avance`, `endpoints`, `dns-avance`, `ingress-avance`
- continue `administration` and `extend-kubernetes` remaining roadmap chapters

## Next Sprint Checklist (EN)

Execution order is intentionally strict to keep course flow coherent.

### Sprint A - Architecture + Containers foundation

- [ ] `architecture/components-intro`
- [ ] `architecture/nodes`
- [ ] `architecture/control-plane-components`
- [ ] `architecture/controllers-pattern`
- [ ] `containers/images-container`
- [ ] `containers/container-environment`
- [ ] `containers/lifecycle-hooks`

### Sprint B - Workloads advanced controllers

- [ ] `workloads/deployments-avance`
- [ ] `workloads/statefulsets-avance`
- [ ] `workloads/daemonsets`
- [ ] `workloads/jobs-avance`

### Sprint C - Networking advanced path

- [ ] `services-networking/services-avance`
- [ ] `services-networking/endpoints`
- [ ] `services-networking/dns-avance`
- [ ] `services-networking/ingress-avance`

### Sprint D - Administration remaining chapters

- [ ] `administration/node-autoscaling`
- [ ] `administration/admission-webhooks`
- [ ] `administration/flow-control`

### Sprint E - Extend Kubernetes remaining chapters

- [ ] `extend-kubernetes/admission-webhooks-dev`
- [ ] `extend-kubernetes/api-aggregation`

### Done Criteria per chapter

- [ ] `chapter.json` created and aligned with naming/order conventions
- [ ] exactly 3 EN lessons (`01-*`, `02-*`, `03-*`) per chapter
- [ ] each `en/content.md` has H1 + callout + `bash` or `yaml` code block
- [ ] each lesson has `en/quiz.ts` with multiple-choice questions only

## Content Contract (EN lessons)

For each lesson:

- one H1 title
- at least one callout (`:::info`, `:::warning`, or `:::important`)
- at least one code block (`bash` or `yaml`)
- one simple quiz file with **multiple-choice only**

## Long-Form Rewrite Progress (EN)

- Scope: all existing `en/content.md` lessons under `src/courses/modules`
- Total lessons: `121`
- Lessons updated to long-form: `121`
- Validation status: `ALL_CHECKS_PASS`
- Current baseline:
  - each EN lesson is at least 70 lines
  - each EN lesson has H1 + callout + at least two `bash`/`yaml` code blocks
  - EN quizzes remain multiple-choice only
