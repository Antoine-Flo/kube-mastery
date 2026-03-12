import { describe, expect, it } from 'vitest'
import { createEventBus } from '../../../../src/core/cluster/events/EventBus'
import {
  createPodLifecycleController,
  PodLifecycleController
} from '../../../../src/core/cluster/controllers/PodLifecycleController'
import type { PodUpdatedEvent } from '../../../../src/core/cluster/events/types'
import { createNode } from '../../../../src/core/cluster/ressources/Node'
import {
  createPod,
  type Pod
} from '../../../../src/core/cluster/ressources/Pod'
import type { ControllerState } from '../../../../src/core/cluster/controllers/types'

describe('PodLifecycleController runtime enrichment', () => {
  it('sets runtime fields when scheduled pod moves to Running', () => {
    const eventBus = createEventBus()
    const node = createNode({
      name: 'conformance-worker',
      labels: {
        'kubernetes.io/os': 'linux'
      },
      status: {
        addresses: [
          { type: 'InternalIP', address: '172.18.0.3' },
          { type: 'Hostname', address: 'conformance-worker' }
        ],
        conditions: [{ type: 'Ready', status: 'True' }],
        nodeInfo: {
          architecture: 'amd64',
          containerRuntimeVersion: 'containerd://2.2.0',
          kernelVersion: '6.18.9-200.fc43.x86_64',
          kubeletVersion: 'v1.35.0',
          operatingSystem: 'linux',
          osImage: 'Debian GNU/Linux 12 (bookworm)'
        }
      }
    })
    let pod: Pod = createPod({
      name: 'web',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      containers: [{ name: 'nginx', image: 'nginx:1.28' }]
    })

    const state: ControllerState = {
      getDeployments: () => [],
      findDeployment: () => ({ ok: false }),
      getDaemonSets: () => [],
      findDaemonSet: () => ({ ok: false }),
      getReplicaSets: () => [],
      findReplicaSet: () => ({ ok: false }),
      getPods: () => [pod],
      findPod: () => ({ ok: true, value: pod }),
      getNodes: () => [node],
      getPersistentVolumes: () => [],
      findPersistentVolume: () => ({ ok: false }),
      getPersistentVolumeClaims: () => [],
      findPersistentVolumeClaim: () => ({ ok: false })
    }

    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      pod = event.payload.pod
    })

    const controller = createPodLifecycleController(eventBus, () => state)
    controller.reconcile('default/web')

    expect(pod.status.phase).toBe('Running')
    expect(pod.status.startTime).toBeDefined()
    expect(pod.status.hostIP).toBe('172.18.0.3')
    expect(pod.status.hostIPs?.[0]?.ip).toBe('172.18.0.3')
    expect(pod.status.observedGeneration).toBe(1)
    expect(Array.isArray(pod.status.conditions)).toBe(true)
    expect(
      pod.status.conditions?.some((condition) => condition.type === 'Ready')
    ).toBe(true)

    controller.stop()
  })

  it('marks waiting reason when volume readiness blocks startup', () => {
    const eventBus = createEventBus()
    let pod: Pod = createPod({
      name: 'web',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      containers: [{ name: 'nginx', image: 'nginx:1.28' }]
    })
    const state: ControllerState = {
      getDeployments: () => [],
      findDeployment: () => ({ ok: false }),
      getDaemonSets: () => [],
      findDaemonSet: () => ({ ok: false }),
      getReplicaSets: () => [],
      findReplicaSet: () => ({ ok: false }),
      getPods: () => [pod],
      findPod: () => ({ ok: true, value: pod }),
      getNodes: () => [],
      getPersistentVolumes: () => [],
      findPersistentVolume: () => ({ ok: false }),
      getPersistentVolumeClaims: () => [],
      findPersistentVolumeClaim: () => ({ ok: false })
    }

    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      pod = event.payload.pod
    })

    const controller = createPodLifecycleController(eventBus, () => state, {
      volumeReadinessProbe: () => {
        return {
          ready: false,
          reason: 'WaitingForPVC'
        }
      }
    })

    controller.reconcile('default/web')
    expect(pod.status.phase).toBe('Pending')
    expect(pod.status.containerStatuses?.[0]?.waitingReason).toBe(
      'WaitingForPVC'
    )
    expect(
      pod.status.conditions?.some(
        (condition) => condition.type === 'PodScheduled'
      )
    ).toBe(true)

    controller.stop()
  })

  it('increments restartCount only once while staying in CrashLoopBackOff', () => {
    const eventBus = createEventBus()
    let pod: Pod = createPod({
      name: 'broken-web',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      containers: [{ name: 'app', image: 'myregistry.io/broken-app:latest' }]
    })
    let podUpdatedEvents = 0
    const state: ControllerState = {
      getDeployments: () => [],
      findDeployment: () => ({ ok: false }),
      getDaemonSets: () => [],
      findDaemonSet: () => ({ ok: false }),
      getReplicaSets: () => [],
      findReplicaSet: () => ({ ok: false }),
      getPods: () => [pod],
      findPod: () => ({ ok: true, value: pod }),
      getNodes: () => [],
      getPersistentVolumes: () => [],
      findPersistentVolume: () => ({ ok: false }),
      getPersistentVolumeClaims: () => [],
      findPersistentVolumeClaim: () => ({ ok: false })
    }

    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      pod = event.payload.pod
      podUpdatedEvents += 1
    })

    const controller = new PodLifecycleController(eventBus, () => state)

    controller.reconcile('default/broken-web')
    const firstRestartCount = pod.status.containerStatuses?.[0]?.restartCount

    controller.reconcile('default/broken-web')
    const secondRestartCount = pod.status.containerStatuses?.[0]?.restartCount

    expect(pod.status.containerStatuses?.[0]?.waitingReason).toBe(
      'CrashLoopBackOff'
    )
    expect(firstRestartCount).toBe(1)
    expect(secondRestartCount).toBe(1)
    expect(podUpdatedEvents).toBe(1)
  })
})
