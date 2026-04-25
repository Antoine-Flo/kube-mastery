# Suivi de Génération du Contenu

Mis à jour au fil des batches. Statuts : `pending` / `in-progress` / `done` / `skip`.

---

## Règles générales (rappel)

**Toutes les leçons doivent respecter intégralement [`src/courses/prompt.md`](prompt.md). Le lire avant chaque batch.**

Rappel des points clés :

- 500-1000 mots par leçon
- Concrete-Abstract-Concrete, diagramme Mermaid AVANT le texte
- Quiz inline (pas de section Hands-On séparée)
- Au moins un `:::warning` (cas d'échec) par leçon
- Commandes supportées uniquement (no pipes, no loops, no `;`, no `\`)
- YAML illustratif : `# illustrative only` ; YAML applicable : précéder de `nano <file.yaml>`
- Modèles de référence : `src/courses/modules/crash-course-workloads/*.md`

---

## Batch 1 : `onboarding` (refactor) + `kubernetes-basics` - DONE

### `onboarding`

| #   | Leçon                     | Statut |
| --- | ------------------------- | ------ |
| 01  | how-to-use-this-platform  | `done` |
| 02  | your-practice-environment | `done` |
| 03  | certification-overview    | `done` |

### `kubernetes-basics`

| #   | Leçon                         | Statut |
| --- | ----------------------------- | ------ |
| 01  | what-is-kubernetes            | `done` |
| 02  | evolution-of-deployment       | `done` |
| 03  | cluster-architecture-overview | `done` |
| 04  | control-plane-components      | `done` |
| 05  | node-components               | `done` |

---

## Batch 2 : `yaml-and-objects` + `pods` - DONE

### `yaml-and-objects`

| #   | Leçon                           | Statut |
| --- | ------------------------------- | ------ |
| 01  | kubernetes-object-model         | `done` |
| 02  | anatomy-of-a-manifest           | `done` |
| 03  | generating-manifests-from-cli   | `done` |
| 04  | object-names-uids-and-dns-rules | `done` |

### `pods`

| #   | Leçon                      | Statut |
| --- | -------------------------- | ------ |
| 01  | what-is-a-pod              | `done` |
| 02  | pod-structure              | `done` |
| 03  | creating-your-first-pod    | `done` |
| 04  | pod-lifecycle-and-phases   | `done` |
| 05  | container-restart-policies | `done` |
| 06  | editing-pods               | `done` |

---

## Batch 3 : `kubectl-essentials` + `namespaces` - DONE

### `kubectl-essentials`

| #   | Leçon                          | Statut |
| --- | ------------------------------ | ------ |
| 01  | imperative-vs-declarative      | `done` |
| 02  | viewing-resources              | `done` |
| 03  | logs-and-exec                  | `done` |
| 04  | creating-and-editing-resources | `done` |
| 05  | delete-and-cleanup             | `done` |
| 06  | formatting-output-and-tips     | `done` |

### `namespaces`

| #   | Leçon                           | Statut |
| --- | ------------------------------- | ------ |
| 01  | what-are-namespaces             | `done` |
| 02  | default-namespaces              | `done` |
| 03  | working-across-namespaces       | `done` |
| 04  | when-to-use-multiple-namespaces | `done` |

---

## Batch 4 : `labels-and-annotations` + `replicasets` - DONE

### `labels-and-annotations`

| #   | Leçon              | Statut |
| --- | ------------------ | ------ |
| 01  | what-are-labels    | `done` |
| 02  | label-selectors    | `done` |
| 03  | annotations        | `done` |
| 04  | recommended-labels | `done` |

### `replicasets`

| #   | Leçon                      | Statut |
| --- | -------------------------- | ------ |
| 01  | why-replicasets            | `done` |
| 02  | creating-a-replicaset      | `done` |
| 03  | scaling-and-self-healing   | `done` |
| 04  | limitations-of-replicasets | `done` |

---

## Batch 5 : `deployments` + `services` - DONE

### `deployments`

| #   | Leçon                         | Statut |
| --- | ----------------------------- | ------ |
| 01  | what-is-a-deployment          | `done` |
| 02  | creating-a-deployment         | `done` |
| 03  | rolling-updates               | `done` |
| 04  | rollback-and-revision-history | `done` |
| 05  | update-strategies             | `done` |

### `services`

| #   | Leçon                 | Statut |
| --- | --------------------- | ------ |
| 01  | why-services          | `done` |
| 02  | service-and-endpoints | `done` |
| 03  | clusterip             | `done` |
| 04  | nodeport              | `done` |
| 05  | loadbalancer          | `done` |
| 06  | named-ports           | `done` |

---

## Batch 6 : `dns` + `ingress` - DONE

### `dns`

| #   | Leçon               | Statut |
| --- | ------------------- | ------ |
| 01  | dns-in-kubernetes   | `done` |
| 02  | service-dns-records | `done` |
| 03  | pod-dns-records     | `done` |
| 04  | dns-debugging       | `done` |

### `ingress`

| #   | Leçon                          | Statut |
| --- | ------------------------------ | ------ |
| 01  | what-is-ingress                | `done` |
| 02  | ingress-controllers            | `done` |
| 03  | routing-rules                  | `done` |
| 04  | tls-termination                | `done` |
| 05  | annotations-and-rewrite-target | `done` |

---

## Batch 7 : `network-policies` + `volumes` - DONE

### `network-policies`

| #   | Leçon                     | Statut |
| --- | ------------------------- | ------ |
| 01  | what-are-network-policies | `done` |
| 02  | networkpolicy-structure   | `done` |
| 03  | ingress-rules             | `done` |
| 04  | egress-rules              | `done` |
| 05  | advanced-rules            | `done` |

### `volumes`

| #   | Leçon                        | Statut |
| --- | ---------------------------- | ------ |
| 01  | why-volumes                  | `done` |
| 02  | emptydir                     | `done` |
| 03  | hostpath                     | `done` |
| 04  | configmap-and-secret-volumes | `done` |

---

## Batch 8 : `persistent-storage` + `logging-and-monitoring` - DONE

### `persistent-storage`

| #   | Leçon                             | Statut |
| --- | --------------------------------- | ------ |
| 01  | pv-and-pvc-concepts               | `done` |
| 02  | creating-a-persistentvolume       | `done` |
| 03  | creating-a-persistentvolumeclaim  | `done` |
| 04  | using-pvcs-in-pods                | `done` |
| 05  | access-modes-and-reclaim-policies | `done` |

### `logging-and-monitoring`

| #   | Leçon                             | Statut |
| --- | --------------------------------- | ------ |
| 01  | container-logging-basics          | `done` |
| 02  | monitoring-with-metrics-server    | `done` |
| 03  | kubernetes-events                 | `done` |
| 04  | monitoring-cluster-component-logs | `done` |

---

## Totaux

- Total leçons : 74
- Done : 74 / 74 - COMPLET !
- Pending : 0
