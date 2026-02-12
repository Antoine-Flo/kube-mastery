// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM PODS (kind-like pre-installed components)
// ═══════════════════════════════════════════════════════════════════════════
// Hardcoded pods for kube-system and local-path-storage so that
// kubectl get pods -A matches a real kind cluster (same namespaces and types).

import type { Pod } from './ressources/Pod'
import { createPod } from './ressources/Pod'

const PAST_TIMESTAMP = '2024-01-01T12:00:00Z'

const minimalContainer = (
  name: string,
  image: string = 'k8s.gcr.io/pause:3.9'
) => ({
  name,
  image
})

/**
 * Returns a list of system pods (kube-system, local-path-storage) to be
 * added to the cluster state after loading a seed. Aligns with what kind
 * installs so that get pods -A output is comparable.
 */
export const getSystemPods = (): Pod[] => {
  const kubeSystem: Pod[] = [
    createPod({
      name: 'coredns-1',
      namespace: 'kube-system',
      containers: [minimalContainer('coredns')],
      creationTimestamp: PAST_TIMESTAMP,
      phase: 'Running'
    }),
    createPod({
      name: 'coredns-2',
      namespace: 'kube-system',
      containers: [minimalContainer('coredns')],
      creationTimestamp: PAST_TIMESTAMP,
      phase: 'Running'
    }),
    createPod({
      name: 'etcd-control-plane',
      namespace: 'kube-system',
      containers: [minimalContainer('etcd')],
      creationTimestamp: PAST_TIMESTAMP,
      phase: 'Running'
    }),
    createPod({
      name: 'kindnet-1',
      namespace: 'kube-system',
      containers: [minimalContainer('kindnet')],
      creationTimestamp: PAST_TIMESTAMP,
      phase: 'Running'
    }),
    createPod({
      name: 'kindnet-2',
      namespace: 'kube-system',
      containers: [minimalContainer('kindnet')],
      creationTimestamp: PAST_TIMESTAMP,
      phase: 'Running'
    }),
    createPod({
      name: 'kindnet-3',
      namespace: 'kube-system',
      containers: [minimalContainer('kindnet')],
      creationTimestamp: PAST_TIMESTAMP,
      phase: 'Running'
    }),
    createPod({
      name: 'kube-apiserver-control-plane',
      namespace: 'kube-system',
      containers: [minimalContainer('kube-apiserver')],
      creationTimestamp: PAST_TIMESTAMP,
      phase: 'Running'
    }),
    createPod({
      name: 'kube-controller-manager-control-plane',
      namespace: 'kube-system',
      containers: [minimalContainer('kube-controller-manager')],
      creationTimestamp: PAST_TIMESTAMP,
      phase: 'Running'
    }),
    createPod({
      name: 'kube-proxy-1',
      namespace: 'kube-system',
      containers: [minimalContainer('kube-proxy')],
      creationTimestamp: PAST_TIMESTAMP,
      phase: 'Running'
    }),
    createPod({
      name: 'kube-proxy-2',
      namespace: 'kube-system',
      containers: [minimalContainer('kube-proxy')],
      creationTimestamp: PAST_TIMESTAMP,
      phase: 'Running'
    }),
    createPod({
      name: 'kube-proxy-3',
      namespace: 'kube-system',
      containers: [minimalContainer('kube-proxy')],
      creationTimestamp: PAST_TIMESTAMP,
      phase: 'Running'
    }),
    createPod({
      name: 'kube-scheduler-control-plane',
      namespace: 'kube-system',
      containers: [minimalContainer('kube-scheduler')],
      creationTimestamp: PAST_TIMESTAMP,
      phase: 'Running'
    })
  ]

  const localPathStorage: Pod[] = [
    createPod({
      name: 'local-path-provisioner-1',
      namespace: 'local-path-storage',
      containers: [minimalContainer('local-path-provisioner')],
      creationTimestamp: PAST_TIMESTAMP,
      phase: 'Running'
    })
  ]

  return [...kubeSystem, ...localPathStorage]
}
