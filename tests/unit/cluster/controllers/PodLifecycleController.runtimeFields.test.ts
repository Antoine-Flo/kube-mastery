import { afterEach, describe, expect, it, vi } from 'vitest'
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
  afterEach(() => {
    vi.useRealTimers()
  })

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

  it('marks nginx pod as CrashLoopBackOff with invalid positional args', () => {
    const eventBus = createEventBus()
    let pod: Pod = createPod({
      name: 'bad-nginx',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      containers: [{ name: 'nginx', image: 'nginx:1.28', args: ['pod'] }]
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

    const controller = createPodLifecycleController(eventBus, () => state)
    controller.reconcile('default/bad-nginx')

    expect(pod.status.phase).toBe('Pending')
    expect(pod.status.containerStatuses?.[0]?.waitingReason).toBe(
      'CrashLoopBackOff'
    )

    controller.stop()
  })

  it('does not mark unrelated image as CrashLoopBackOff for positional args', () => {
    const eventBus = createEventBus()
    let pod: Pod = createPod({
      name: 'busybox-args',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      containers: [{ name: 'busybox', image: 'busybox:1.36', args: ['pod'] }]
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

    const controller = createPodLifecycleController(eventBus, () => state)
    controller.reconcile('default/busybox-args')

    expect(pod.status.containerStatuses?.[0]?.waitingReason).toBeUndefined()
    expect(pod.status.phase).toBe('Running')

    controller.stop()
  })

  it('restarts crashing pod with exponential backoff', () => {
    vi.useFakeTimers()
    const eventBus = createEventBus()
    let pod: Pod = createPod({
      name: 'looping-nginx',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      containers: [{ name: 'nginx', image: 'nginx:1.28', args: ['pod'] }]
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
      restartBackoffMs: {
        initialMs: 10,
        maxMs: 40
      }
    })

    controller.reconcile('default/looping-nginx')
    expect(pod.status.containerStatuses?.[0]?.restartCount).toBe(1)
    expect(pod.status.containerStatuses?.[0]?.waitingReason).toBe(
      'CrashLoopBackOff'
    )
    expect(pod.status.containerStatuses?.[0]?.lastRestartAt).toBeDefined()

    vi.advanceTimersByTime(10)
    vi.runOnlyPendingTimers()
    expect(pod.status.containerStatuses?.[0]?.restartCount).toBe(2)

    vi.advanceTimersByTime(20)
    vi.runOnlyPendingTimers()
    expect(pod.status.containerStatuses?.[0]?.restartCount).toBe(3)

    controller.stop()
  })

  it('does not restart crashing pod when restartPolicy is Never', () => {
    vi.useFakeTimers()
    const eventBus = createEventBus()
    let pod: Pod = createPod({
      name: 'no-restart-nginx',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      restartPolicy: 'Never',
      containers: [{ name: 'nginx', image: 'nginx:1.28', args: ['pod'] }]
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

    const controller = createPodLifecycleController(eventBus, () => state)
    controller.reconcile('default/no-restart-nginx')

    expect(pod.status.containerStatuses?.[0]?.waitingReason).toBe('Error')
    expect(pod.status.containerStatuses?.[0]?.restartCount).toBe(0)

    vi.runOnlyPendingTimers()
    expect(pod.status.containerStatuses?.[0]?.restartCount).toBe(0)

    controller.stop()
  })
})
