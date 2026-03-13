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

  it('starts with ContainerCreating then transitions to ErrImagePull and ImagePullBackOff', () => {
    vi.useFakeTimers()
    const eventBus = createEventBus()
    let pod: Pod = createPod({
      name: 'missing-image',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      containers: [{ name: 'app', image: 'toto' }]
    })
    const waitingReasons: string[] = []
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
      const waitingReason = pod.status.containerStatuses?.[0]?.waitingReason
      if (waitingReason != null) {
        waitingReasons.push(waitingReason)
      }
    })

    const controller = createPodLifecycleController(eventBus, () => state, {
      imagePullTimingMs: {
        initialPullMs: 5,
        retryPullMs: 2,
        errTransitionMs: 3
      },
      imagePullBackoffMs: {
        initialMs: 10,
        maxMs: 40
      }
    })

    controller.reconcile('default/missing-image')
    expect(waitingReasons).toEqual(['ContainerCreating'])

    vi.advanceTimersByTime(5)
    vi.runOnlyPendingTimers()
    expect(waitingReasons).toContain('ErrImagePull')
    expect(pod.status.containerStatuses?.[0]?.restartCount).toBe(0)

    vi.advanceTimersByTime(3)
    vi.runOnlyPendingTimers()
    expect(waitingReasons).toContain('ImagePullBackOff')
    expect(pod.status.containerStatuses?.[0]?.restartCount).toBe(0)

    controller.stop()
  })

  it('retries missing image without increasing restartCount', () => {
    vi.useFakeTimers()
    const eventBus = createEventBus()
    let pod: Pod = createPod({
      name: 'missing-image-retry',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      containers: [{ name: 'app', image: 'toto' }]
    })
    const waitingReasons: string[] = []
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
      const waitingReason = pod.status.containerStatuses?.[0]?.waitingReason
      if (waitingReason != null) {
        waitingReasons.push(waitingReason)
      }
    })

    const controller = createPodLifecycleController(eventBus, () => state, {
      imagePullTimingMs: {
        initialPullMs: 1,
        retryPullMs: 1,
        errTransitionMs: 1
      },
      imagePullBackoffMs: {
        initialMs: 5,
        maxMs: 10
      }
    })

    controller.reconcile('default/missing-image-retry')
    vi.advanceTimersByTime(1)
    vi.runOnlyPendingTimers()
    vi.advanceTimersByTime(1)
    vi.runOnlyPendingTimers()
    vi.advanceTimersByTime(5)
    vi.runOnlyPendingTimers()
    vi.advanceTimersByTime(1)
    vi.runOnlyPendingTimers()

    const errCount = waitingReasons.filter((reason) => reason === 'ErrImagePull').length
    const backoffCount = waitingReasons.filter(
      (reason) => reason === 'ImagePullBackOff'
    ).length
    expect(errCount).toBeGreaterThanOrEqual(2)
    expect(backoffCount).toBeGreaterThanOrEqual(1)
    expect(pod.status.containerStatuses?.[0]?.restartCount).toBe(0)

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

    const controller = new PodLifecycleController(eventBus, () => state, {
      crashLoopTimingMs: {
        errorToBackoffMs: 0
      }
    })

    controller.reconcile('default/broken-web')
    const firstRestartCount = pod.status.containerStatuses?.[0]?.restartCount

    controller.reconcile('default/broken-web')
    const secondRestartCount = pod.status.containerStatuses?.[0]?.restartCount

    expect(pod.status.containerStatuses?.[0]?.waitingReason).toBe(
      'CrashLoopBackOff'
    )
    expect(firstRestartCount).toBe(1)
    expect(secondRestartCount).toBe(1)
    expect(podUpdatedEvents).toBe(2)
  })

  it('emits Error before CrashLoopBackOff for crashing pod', () => {
    vi.useFakeTimers()
    const eventBus = createEventBus()
    let pod: Pod = createPod({
      name: 'broken-sequence',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      containers: [{ name: 'app', image: 'myregistry.io/broken-app:latest' }]
    })
    const waitingReasons: string[] = []
    const terminatedReasons: string[] = []
    const states: string[] = []
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
      const status = pod.status.containerStatuses?.[0]
      states.push(status?.state ?? 'Unknown')
      waitingReasons.push(status?.waitingReason ?? '')
      terminatedReasons.push(status?.terminatedReason ?? '')
    })

    const controller = createPodLifecycleController(eventBus, () => state, {
      crashLoopTimingMs: {
        errorToBackoffMs: 5
      }
    })
    controller.reconcile('default/broken-sequence')

    expect(states).toEqual(['Terminated'])
    expect(terminatedReasons[0]).toBe('Error')

    vi.advanceTimersByTime(5)
    vi.runOnlyPendingTimers()
    expect(states).toContain('Waiting')
    expect(waitingReasons).toContain('CrashLoopBackOff')

    controller.stop()
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

    const controller = createPodLifecycleController(eventBus, () => state, {
      crashLoopTimingMs: {
        errorToBackoffMs: 0
      }
    })
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
      },
      crashLoopTimingMs: {
        errorToBackoffMs: 0
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

    expect(pod.status.phase).toBe('Failed')
    expect(pod.status.containerStatuses?.[0]?.state).toBe('Terminated')
    expect(pod.status.containerStatuses?.[0]?.terminatedReason).toBe('Error')
    expect(pod.status.containerStatuses?.[0]?.waitingReason).toBeUndefined()
    expect(pod.status.containerStatuses?.[0]?.restartCount).toBe(0)

    vi.runOnlyPendingTimers()
    expect(pod.status.containerStatuses?.[0]?.restartCount).toBe(0)

    controller.stop()
  })
})
