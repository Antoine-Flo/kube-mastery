// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM PODS (kind-like pre-installed components)
// ═══════════════════════════════════════════════════════════════════════════
// Hardcoded pods for kube-system and local-path-storage so that
// kubectl get pods -A matches a real kind cluster (same namespaces and types).

import { generateKindLikePodName } from './controllers/helpers'
import type { Pod } from './ressources/Pod'
import { createPod } from './ressources/Pod'

const minimalContainer = (
  name: string,
  image: string = 'k8s.gcr.io/pause:3.9'
) => ({
  name,
  image
})

function uniqueKindLikeName(prefix: string, used: Set<string>): string {
  let name: string
  do {
    name = generateKindLikePodName(prefix)
  } while (used.has(name))
  used.add(name)
  return name
}

export interface GetSystemPodsOptions {
  /** Optional clock for creationTimestamp (e.g. for tests/conformance). Default: now */
  clock?: () => string
}

/**
 * Returns a list of system pods (kube-system, local-path-storage) to be
 * added to the cluster state after loading a seed. Aligns with what kind
 * installs so that get pods -A output is comparable.
 * Uses dynamic creationTimestamp so formatAge() shows realistic age (0s, 5s, etc.).
 * Pod names for ReplicaSet-style components use Kind-like format (prefix-hash-suffix).
 */
export const getSystemPods = (options?: GetSystemPodsOptions): Pod[] => {
  const now =
    options?.clock != null ? options.clock() : new Date().toISOString()
  const usedNames = new Set<string>()

  const kubeSystem: Pod[] = [
    createPod({
      name: uniqueKindLikeName('coredns', usedNames),
      namespace: 'kube-system',
      containers: [minimalContainer('coredns')],
      creationTimestamp: now,
      phase: 'Pending'
    }),
    createPod({
      name: uniqueKindLikeName('coredns', usedNames),
      namespace: 'kube-system',
      containers: [minimalContainer('coredns')],
      creationTimestamp: now,
      phase: 'Pending'
    }),
    createPod({
      name: 'etcd-control-plane',
      namespace: 'kube-system',
      containers: [minimalContainer('etcd')],
      creationTimestamp: now,
      phase: 'Pending'
    }),
    createPod({
      name: uniqueKindLikeName('kindnet', usedNames),
      namespace: 'kube-system',
      containers: [minimalContainer('kindnet')],
      creationTimestamp: now,
      phase: 'Pending'
    }),
    createPod({
      name: uniqueKindLikeName('kindnet', usedNames),
      namespace: 'kube-system',
      containers: [minimalContainer('kindnet')],
      creationTimestamp: now,
      phase: 'Pending'
    }),
    createPod({
      name: uniqueKindLikeName('kindnet', usedNames),
      namespace: 'kube-system',
      containers: [minimalContainer('kindnet')],
      creationTimestamp: now,
      phase: 'Pending'
    }),
    createPod({
      name: 'kube-apiserver-control-plane',
      namespace: 'kube-system',
      containers: [minimalContainer('kube-apiserver')],
      creationTimestamp: now,
      phase: 'Pending'
    }),
    createPod({
      name: 'kube-controller-manager-control-plane',
      namespace: 'kube-system',
      containers: [minimalContainer('kube-controller-manager')],
      creationTimestamp: now,
      phase: 'Pending'
    }),
    createPod({
      name: uniqueKindLikeName('kube-proxy', usedNames),
      namespace: 'kube-system',
      containers: [minimalContainer('kube-proxy')],
      creationTimestamp: now,
      phase: 'Pending'
    }),
    createPod({
      name: uniqueKindLikeName('kube-proxy', usedNames),
      namespace: 'kube-system',
      containers: [minimalContainer('kube-proxy')],
      creationTimestamp: now,
      phase: 'Pending'
    }),
    createPod({
      name: uniqueKindLikeName('kube-proxy', usedNames),
      namespace: 'kube-system',
      containers: [minimalContainer('kube-proxy')],
      creationTimestamp: now,
      phase: 'Pending'
    }),
    createPod({
      name: 'kube-scheduler-control-plane',
      namespace: 'kube-system',
      containers: [minimalContainer('kube-scheduler')],
      creationTimestamp: now,
      phase: 'Pending'
    })
  ]

  const localPathStorage: Pod[] = [
    createPod({
      name: uniqueKindLikeName('local-path-provisioner', usedNames),
      namespace: 'local-path-storage',
      containers: [minimalContainer('local-path-provisioner')],
      creationTimestamp: now,
      phase: 'Pending'
    })
  ]

  return [...kubeSystem, ...localPathStorage]
}
