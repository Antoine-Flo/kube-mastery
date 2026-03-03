import { afterEach, describe, expect, it, vi } from 'vitest'
import { createClusterState } from '../../../../src/core/cluster/ClusterState'
import {
  initializeControllers,
  stopRuntimeControllers
} from '../../../../src/core/cluster/controllers/initializers'
import { createEventBus } from '../../../../src/core/cluster/events/EventBus'
import { createDaemonSet } from '../../../../src/core/cluster/ressources/DaemonSet'
import { createDeployment } from '../../../../src/core/cluster/ressources/Deployment'
import { createNode } from '../../../../src/core/cluster/ressources/Node'
import { createPersistentVolumeClaim } from '../../../../src/core/cluster/ressources/PersistentVolumeClaim'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'

const flushRuntime = (): void => {
  vi.runAllTimers()
}

describe('runtime controller invariants', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('converges Pending+scheduled pod to Running even when created before controller start', () => {
    vi.useFakeTimers()
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus, {
      bootstrap: { profile: 'none', mode: 'never' }
    })
    const pod = createPod({
      name: 'prebound-pod',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'sim-worker',
      containers: [{ name: 'nginx', image: 'nginx:latest' }]
    })
    clusterState.addPod(pod)

    const controllers = initializeControllers(eventBus, clusterState, {
      podLifecycle: {
        pendingDelayRangeMs: { minMs: 0, maxMs: 0 },
        volumeReadinessProbe: (pod) => {
          const volume = pod.spec.volumes?.find((candidate) => {
            return candidate.source.type === 'persistentVolumeClaim'
          })
          if (
            volume == null ||
            volume.source.type !== 'persistentVolumeClaim'
          ) {
            return { ready: true }
          }
          const pvcResult = clusterState.findPersistentVolumeClaim(
            volume.source.claimName,
            pod.metadata.namespace
          )
          if (!pvcResult.ok || pvcResult.value == null) {
            return { ready: false, reason: 'PersistentVolumeClaimNotFound' }
          }
          if (pvcResult.value.status.phase !== 'Bound') {
            return { ready: false, reason: 'PersistentVolumeClaimPending' }
          }
          return { ready: true }
        }
      },
      scheduler: {
        schedulingDelayRangeMs: { minMs: 0, maxMs: 0 }
      }
    })

    flushRuntime()
    const stored = clusterState.findPod('prebound-pod', 'default')
    expect(stored.ok).toBe(true)
    if (!stored.ok || stored.value == null) {
      stopRuntimeControllers(controllers)
      return
    }
    expect(stored.value.status.phase).toBe('Running')

    stopRuntimeControllers(controllers)
  })

  it('keeps pod Pending when referenced PVC is not bound', () => {
    vi.useFakeTimers()
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus, {
      bootstrap: { profile: 'none', mode: 'never' }
    })

    clusterState.addPersistentVolumeClaim(
      createPersistentVolumeClaim({
        name: 'data-claim',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '1Gi' } }
        }
      })
    )
    clusterState.addPod(
      createPod({
        name: 'pod-with-pvc',
        namespace: 'default',
        phase: 'Pending',
        nodeName: 'sim-worker',
        containers: [{ name: 'nginx', image: 'nginx:latest' }],
        volumes: [
          {
            name: 'data',
            source: {
              type: 'persistentVolumeClaim',
              claimName: 'data-claim'
            }
          }
        ]
      })
    )

    const controllers = initializeControllers(eventBus, clusterState, {
      podLifecycle: {
        pendingDelayRangeMs: { minMs: 0, maxMs: 0 },
        volumeReadinessProbe: (pod) => {
          const persistentVolumeClaimVolume = pod.spec.volumes?.find(
            (volume) => {
              return volume.source.type === 'persistentVolumeClaim'
            }
          )
          if (
            persistentVolumeClaimVolume == null ||
            persistentVolumeClaimVolume.source.type !== 'persistentVolumeClaim'
          ) {
            return { ready: true }
          }
          const persistentVolumeClaimResult =
            clusterState.findPersistentVolumeClaim(
              persistentVolumeClaimVolume.source.claimName,
              pod.metadata.namespace
            )
          if (
            !persistentVolumeClaimResult.ok ||
            persistentVolumeClaimResult.value == null
          ) {
            return { ready: false, reason: 'PersistentVolumeClaimNotFound' }
          }
          if (persistentVolumeClaimResult.value.status.phase !== 'Bound') {
            return { ready: false, reason: 'PersistentVolumeClaimPending' }
          }
          return { ready: true }
        }
      },
      scheduler: {
        schedulingDelayRangeMs: { minMs: 0, maxMs: 0 }
      }
    })

    flushRuntime()
    const stored = clusterState.findPod('pod-with-pvc', 'default')
    expect(stored.ok).toBe(true)
    if (!stored.ok || stored.value == null) {
      stopRuntimeControllers(controllers)
      return
    }
    expect(stored.value.status.phase).toBe('Pending')
    const statuses = stored.value.status.containerStatuses ?? []
    expect(statuses[0]?.waitingReason).toBe('PersistentVolumeClaimPending')

    stopRuntimeControllers(controllers)
  })

  it('keeps DaemonSet at one pod per eligible node across restart', () => {
    vi.useFakeTimers()
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus, {
      bootstrap: { profile: 'none', mode: 'never' }
    })
    const nodeStatus = {
      nodeInfo: {
        architecture: 'amd64',
        containerRuntimeVersion: 'containerd://1.7.0',
        kernelVersion: '6.1.0',
        kubeletVersion: 'v1.29.0',
        operatingSystem: 'linux',
        osImage: 'Fedora'
      },
      conditions: [{ type: 'Ready', status: 'True' as const }]
    }
    clusterState.addNode(
      createNode({
        name: 'n1',
        labels: { 'node-role.kubernetes.io/worker': '' },
        status: nodeStatus
      })
    )
    clusterState.addNode(
      createNode({
        name: 'n2',
        labels: { 'node-role.kubernetes.io/worker': '' },
        status: nodeStatus
      })
    )
    clusterState.addDaemonSet(
      createDaemonSet({
        name: 'ds-test',
        namespace: 'kube-system',
        labels: { app: 'ds-test' },
        selector: { matchLabels: { app: 'ds-test' } },
        template: {
          metadata: { labels: { app: 'ds-test' } },
          spec: {
            containers: [{ name: 'agent', image: 'busybox:latest' }]
          }
        }
      })
    )

    let controllers = initializeControllers(eventBus, clusterState, {
      podLifecycle: {
        pendingDelayRangeMs: { minMs: 0, maxMs: 0 }
      }
    })
    flushRuntime()
    stopRuntimeControllers(controllers)

    controllers = initializeControllers(eventBus, clusterState, {
      podLifecycle: {
        pendingDelayRangeMs: { minMs: 0, maxMs: 0 }
      }
    })
    flushRuntime()

    const pods = clusterState
      .getPods('kube-system')
      .filter((pod) =>
        pod.metadata.ownerReferences?.some(
          (owner) => owner.kind === 'DaemonSet' && owner.name === 'ds-test'
        )
      )
    expect(pods.length).toBe(2)
    const nodeNames = new Set(
      pods.map((pod) => pod.spec.nodeName).filter((name) => name != null)
    )
    expect(nodeNames.size).toBe(2)

    stopRuntimeControllers(controllers)
  })

  it('converges Deployment to ReplicaSet and Running pods from pre-existing state', () => {
    vi.useFakeTimers()
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus, {
      bootstrap: { profile: 'none', mode: 'never' }
    })
    clusterState.addNode(
      createNode({
        name: 'worker-1',
        labels: { 'node-role.kubernetes.io/worker': '' },
        status: {
          nodeInfo: {
            architecture: 'amd64',
            containerRuntimeVersion: 'containerd://1.7.0',
            kernelVersion: '6.1.0',
            kubeletVersion: 'v1.29.0',
            operatingSystem: 'linux',
            osImage: 'Fedora'
          },
          conditions: [{ type: 'Ready', status: 'True' }]
        }
      })
    )
    clusterState.addDeployment(
      createDeployment({
        name: 'web',
        namespace: 'default',
        replicas: 2,
        labels: { app: 'web' },
        selector: { matchLabels: { app: 'web' } },
        template: {
          metadata: { labels: { app: 'web' } },
          spec: {
            containers: [{ name: 'web', image: 'nginx:latest' }]
          }
        }
      })
    )

    const controllers = initializeControllers(eventBus, clusterState, {
      scheduler: {
        schedulingDelayRangeMs: { minMs: 0, maxMs: 0 }
      },
      podLifecycle: {
        pendingDelayRangeMs: { minMs: 0, maxMs: 0 }
      }
    })
    flushRuntime()

    const replicaSets = clusterState
      .getReplicaSets('default')
      .filter((rs) =>
        rs.metadata.ownerReferences?.some(
          (owner) => owner.kind === 'Deployment' && owner.name === 'web'
        )
      )
    expect(replicaSets.length).toBe(1)

    const pods = clusterState
      .getPods('default')
      .filter((pod) =>
        pod.metadata.ownerReferences?.some(
          (owner) =>
            owner.kind === 'ReplicaSet' &&
            owner.name === replicaSets[0].metadata.name
        )
      )
    expect(pods.length).toBe(2)
    expect(
      pods.every(
        (pod) =>
          pod.status.phase === 'Running' &&
          pod.spec.nodeName != null &&
          pod.spec.nodeName.length > 0
      )
    ).toBe(true)

    stopRuntimeControllers(controllers)
  })
})
