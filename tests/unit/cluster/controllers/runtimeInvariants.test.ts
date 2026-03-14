import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiServerFacade } from '../../../../src/core/api/ApiServerFacade'
import {
  initializeControlPlane,
  stopControlPlane
} from '../../../../src/core/control-plane/initializers'
import { createDaemonSet } from '../../../../src/core/cluster/ressources/DaemonSet'
import { createDeployment } from '../../../../src/core/cluster/ressources/Deployment'
import { createNode } from '../../../../src/core/cluster/ressources/Node'
import type { NodeStatus } from '../../../../src/core/cluster/ressources/Node'
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
    const apiServer = createApiServerFacade({
      bootstrap: { profile: 'none', mode: 'never' }
    })
    const pod = createPod({
      name: 'prebound-pod',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'sim-worker',
      containers: [{ name: 'nginx', image: 'nginx:latest' }]
    })
    apiServer.createResource('Pod', pod)

    const controllers = initializeControlPlane(apiServer, {
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
          const pvcResult = apiServer.findResource(
            'PersistentVolumeClaim',
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
    const stored = apiServer.findResource('Pod', 'prebound-pod', 'default')
    expect(stored.ok).toBe(true)
    if (!stored.ok || stored.value == null) {
      stopControlPlane(controllers)
      return
    }
    expect(stored.value.status.phase).toBe('Running')

    stopControlPlane(controllers)
  })

  it('keeps pod Pending when referenced PVC is not bound', () => {
    vi.useFakeTimers()
    const apiServer = createApiServerFacade({
      bootstrap: { profile: 'none', mode: 'never' }
    })

    apiServer.createResource(
      'PersistentVolumeClaim',
      createPersistentVolumeClaim({
        name: 'data-claim',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '1Gi' } }
        }
      })
    )
    apiServer.createResource(
      'Pod',
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

    const controllers = initializeControlPlane(apiServer, {
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
          const persistentVolumeClaimResult = apiServer.findResource(
            'PersistentVolumeClaim',
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
    const stored = apiServer.findResource('Pod', 'pod-with-pvc', 'default')
    expect(stored.ok).toBe(true)
    if (!stored.ok || stored.value == null) {
      stopControlPlane(controllers)
      return
    }
    expect(stored.value.status.phase).toBe('Pending')
    const statuses = stored.value.status.containerStatuses ?? []
    expect(statuses[0]?.stateDetails?.reason).toBe('PersistentVolumeClaimPending')

    stopControlPlane(controllers)
  })

  it('keeps DaemonSet at one pod per eligible node across restart', () => {
    vi.useFakeTimers()
    const apiServer = createApiServerFacade({
      bootstrap: { profile: 'none', mode: 'never' }
    })
    const nodeStatus: NodeStatus = {
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
    apiServer.createResource(
      'Node',
      createNode({
        name: 'n1',
        labels: { 'node-role.kubernetes.io/worker': '' },
        status: nodeStatus
      })
    )
    apiServer.createResource(
      'Node',
      createNode({
        name: 'n2',
        labels: { 'node-role.kubernetes.io/worker': '' },
        status: nodeStatus
      })
    )
    apiServer.createResource(
      'DaemonSet',
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

    let controllers = initializeControlPlane(apiServer, {
      podLifecycle: {
        pendingDelayRangeMs: { minMs: 0, maxMs: 0 }
      }
    })
    flushRuntime()
    stopControlPlane(controllers)

    controllers = initializeControlPlane(apiServer, {
      podLifecycle: {
        pendingDelayRangeMs: { minMs: 0, maxMs: 0 }
      }
    })
    flushRuntime()

    const pods = apiServer
      .listResources('Pod', 'kube-system')
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

    stopControlPlane(controllers)
  })

  it('converges Deployment to ReplicaSet and Running pods from pre-existing state', () => {
    vi.useFakeTimers()
    const apiServer = createApiServerFacade({
      bootstrap: { profile: 'none', mode: 'never' }
    })
    apiServer.createResource(
      'Node',
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
    apiServer.createResource(
      'Deployment',
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

    const controllers = initializeControlPlane(apiServer, {
      scheduler: {
        schedulingDelayRangeMs: { minMs: 0, maxMs: 0 }
      },
      podLifecycle: {
        pendingDelayRangeMs: { minMs: 0, maxMs: 0 }
      }
    })
    flushRuntime()

    const replicaSets = apiServer
      .listResources('ReplicaSet', 'default')
      .filter((rs) =>
        rs.metadata.ownerReferences?.some(
          (owner) => owner.kind === 'Deployment' && owner.name === 'web'
        )
      )
    expect(replicaSets.length).toBe(1)

    const pods = apiServer
      .listResources('Pod', 'default')
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

    const deploymentResult = apiServer.findResource('Deployment', 'web', 'default')
    expect(deploymentResult.ok).toBe(true)
    if (!deploymentResult.ok || deploymentResult.value == null) {
      stopControlPlane(controllers)
      return
    }
    expect(deploymentResult.value.status.readyReplicas).toBe(2)
    expect(deploymentResult.value.status.availableReplicas).toBe(2)

    stopControlPlane(controllers)
  })
})
