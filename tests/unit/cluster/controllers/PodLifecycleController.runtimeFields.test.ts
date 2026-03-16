import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiServerFacade } from '../../../../src/core/api/ApiServerFacade'
import { createPodLifecycleController } from '../../../../src/core/kubelet/controllers/PodLifecycleController'
import {
  createPodDeletedEvent,
  type PodUpdatedEvent
} from '../../../../src/core/cluster/events/types'
import { createNode } from '../../../../src/core/cluster/ressources/Node'
import {
  createPod,
  type Pod
} from '../../../../src/core/cluster/ressources/Pod'
import { createContainerRuntimeSimulator } from '../../../../src/core/runtime/ContainerRuntimeSimulator'

describe('PodLifecycleController runtime enrichment', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('sets runtime fields when scheduled pod moves to Running', () => {
    const apiServer = createApiServerFacade()
    const eventBus = apiServer.eventBus
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

    apiServer.createResource('Node', node)
    apiServer.createResource('Pod', pod)

    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      pod = event.payload.pod
    })

    const controller = createPodLifecycleController(apiServer)
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
    expect(pod.status.containerStatuses?.[0]?.stateDetails?.state).toBe('Running')

    controller.stop()
  })

  it('syncs runtime container records on running and pod deletion', () => {
    const apiServer = createApiServerFacade()
    const eventBus = apiServer.eventBus
    const runtime = createContainerRuntimeSimulator()
    let pod: Pod = createPod({
      name: 'runtime-web',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      containers: [{ name: 'nginx', image: 'nginx:1.28' }]
    })
    apiServer.createResource('Pod', pod)

    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      pod = event.payload.pod
    })

    const controller = createPodLifecycleController(apiServer, {
      containerRuntime: runtime
    })

    controller.reconcile('default/runtime-web')
    const runtimeRunning = runtime.listContainers({
      nodeName: 'conformance-worker',
      namespace: 'default',
      podName: 'runtime-web',
      state: 'Running'
    })
    expect(runtimeRunning.length).toBe(1)
    expect(runtimeRunning[0]?.containerName).toBe('nginx')
    expect(pod.status.containerStatuses?.[0]?.containerID).toBe(
      runtimeRunning[0]?.containerId
    )
    expect(pod.status.containerStatuses?.[0]?.startedAt).toBe(
      runtimeRunning[0]?.startedAt
    )
    expect(pod.status.containerStatuses?.[0]?.stateDetails?.startedAt).toBe(
      runtimeRunning[0]?.startedAt
    )

    eventBus.emit(
      createPodDeletedEvent(
        pod.metadata.name,
        pod.metadata.namespace,
        pod,
        'test'
      )
    )
    const runtimeAfterDelete = runtime.listContainers({
      nodeName: 'conformance-worker',
      namespace: 'default',
      podName: 'runtime-web',
      state: 'Running'
    })
    expect(runtimeAfterDelete.length).toBe(0)
    const terminatedAfterDelete = runtime.listContainers({
      nodeName: 'conformance-worker',
      namespace: 'default',
      podName: 'runtime-web',
      state: 'Terminated'
    })
    expect(terminatedAfterDelete.length).toBe(1)
    expect(terminatedAfterDelete[0]?.reason).toBe('PodDeleted')

    controller.stop()
  })

  it('marks waiting reason when volume readiness blocks startup', () => {
    const apiServer = createApiServerFacade()
    const eventBus = apiServer.eventBus
    let pod: Pod = createPod({
      name: 'web',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      containers: [{ name: 'nginx', image: 'nginx:1.28' }]
    })
    apiServer.createResource('Pod', pod)

    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      pod = event.payload.pod
    })

    const controller = createPodLifecycleController(apiServer, {
      volumeReadinessProbe: () => {
        return {
          ready: false,
          reason: 'WaitingForPVC'
        }
      }
    })

    controller.reconcile('default/web')
    expect(pod.status.phase).toBe('Pending')
    expect(pod.status.containerStatuses?.[0]?.stateDetails?.reason).toBe(
      'WaitingForPVC'
    )
    expect(pod.status.containerStatuses?.[0]?.stateDetails?.state).toBe('Waiting')
    expect(pod.status.containerStatuses?.[0]?.stateDetails?.reason).toBe(
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
    const apiServer = createApiServerFacade()
    const eventBus = apiServer.eventBus
    let pod: Pod = createPod({
      name: 'missing-image',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      containers: [{ name: 'app', image: 'toto' }]
    })
    const waitingReasons: string[] = []
    apiServer.createResource('Pod', pod)

    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      pod = event.payload.pod
      const waitingReason = pod.status.containerStatuses?.[0]?.stateDetails?.reason
      if (waitingReason != null) {
        waitingReasons.push(waitingReason)
      }
    })

    const controller = createPodLifecycleController(apiServer, {
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
    const apiServer = createApiServerFacade()
    const eventBus = apiServer.eventBus
    let pod: Pod = createPod({
      name: 'missing-image-retry',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      containers: [{ name: 'app', image: 'toto' }]
    })
    const waitingReasons: string[] = []
    apiServer.createResource('Pod', pod)

    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      pod = event.payload.pod
      const waitingReason = pod.status.containerStatuses?.[0]?.stateDetails?.reason
      if (waitingReason != null) {
        waitingReasons.push(waitingReason)
      }
    })

    const controller = createPodLifecycleController(apiServer, {
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
    const apiServer = createApiServerFacade()
    const eventBus = apiServer.eventBus
    let pod: Pod = createPod({
      name: 'broken-web',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      containers: [
        {
          name: 'app',
          image: 'busybox:1.36',
          args: ['sh', '-c', 'exit 1']
        }
      ]
    })
    let podUpdatedEvents = 0
    apiServer.createResource('Pod', pod)

    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      pod = event.payload.pod
      podUpdatedEvents += 1
    })

    const controller = createPodLifecycleController(apiServer, {
      crashLoopTimingMs: {
        errorToBackoffMs: 0
      }
    })

    controller.reconcile('default/broken-web')
    const firstRestartCount = pod.status.containerStatuses?.[0]?.restartCount

    controller.reconcile('default/broken-web')
    const secondRestartCount = pod.status.containerStatuses?.[0]?.restartCount

    expect(pod.status.containerStatuses?.[0]?.stateDetails?.reason).toBe(
      'CrashLoopBackOff'
    )
    expect(firstRestartCount).toBe(1)
    expect(secondRestartCount).toBe(1)
    expect(podUpdatedEvents).toBe(2)
    controller.stop()
  })

  it('emits Error before CrashLoopBackOff for crashing pod', () => {
    vi.useFakeTimers()
    const apiServer = createApiServerFacade()
    const eventBus = apiServer.eventBus
    let pod: Pod = createPod({
      name: 'broken-sequence',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      containers: [
        {
          name: 'app',
          image: 'busybox:1.36',
          args: ['sh', '-c', 'exit 1']
        }
      ]
    })
    const waitingReasons: string[] = []
    const terminatedReasons: string[] = []
    const states: string[] = []
    apiServer.createResource('Pod', pod)

    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      pod = event.payload.pod
      const status = pod.status.containerStatuses?.[0]
      states.push(status?.stateDetails?.state ?? 'Unknown')
      waitingReasons.push(status?.stateDetails?.reason ?? '')
      terminatedReasons.push(status?.stateDetails?.reason ?? '')
    })

    const controller = createPodLifecycleController(apiServer, {
      crashLoopTimingMs: {
        errorToBackoffMs: 5
      }
    })
    controller.reconcile('default/broken-sequence')

    expect(states).toEqual(['Terminated'])
    expect(terminatedReasons[0]).toBe('Error')
    expect(pod.status.containerStatuses?.[0]?.stateDetails?.state).toBe(
      'Terminated'
    )
    expect(pod.status.containerStatuses?.[0]?.stateDetails?.exitCode).toBe(1)

    vi.advanceTimersByTime(5)
    vi.runOnlyPendingTimers()
    expect(states).toContain('Waiting')
    expect(waitingReasons).toContain('CrashLoopBackOff')
    expect(pod.status.containerStatuses?.[0]?.lastStateDetails?.state).toBe(
      'Terminated'
    )

    controller.stop()
  })

  it('marks nginx pod as CrashLoopBackOff with invalid positional args', () => {
    const apiServer = createApiServerFacade()
    const eventBus = apiServer.eventBus
    let pod: Pod = createPod({
      name: 'bad-nginx',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      containers: [{ name: 'nginx', image: 'nginx:1.28', args: ['pod'] }]
    })
    apiServer.createResource('Pod', pod)

    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      pod = event.payload.pod
    })

    const controller = createPodLifecycleController(apiServer, {
      crashLoopTimingMs: {
        errorToBackoffMs: 0
      }
    })
    controller.reconcile('default/bad-nginx')

    expect(pod.status.phase).toBe('Pending')
    expect(pod.status.containerStatuses?.[0]?.stateDetails?.reason).toBe(
      'CrashLoopBackOff'
    )

    controller.stop()
  })

  it('does not mark unrelated image as CrashLoopBackOff for positional args', () => {
    const apiServer = createApiServerFacade()
    const eventBus = apiServer.eventBus
    let pod: Pod = createPod({
      name: 'busybox-args',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      containers: [{ name: 'busybox', image: 'busybox:1.36', args: ['pod'] }]
    })
    apiServer.createResource('Pod', pod)

    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      pod = event.payload.pod
    })

    const controller = createPodLifecycleController(apiServer)
    controller.reconcile('default/busybox-args')

    expect(pod.status.containerStatuses?.[0]?.stateDetails?.reason).toBeUndefined()
    expect(pod.status.phase).toBe('Running')

    controller.stop()
  })

  it('restarts crashing pod with exponential backoff', () => {
    vi.useFakeTimers()
    const apiServer = createApiServerFacade()
    const eventBus = apiServer.eventBus
    let pod: Pod = createPod({
      name: 'looping-nginx',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      containers: [{ name: 'nginx', image: 'nginx:1.28', args: ['pod'] }]
    })
    apiServer.createResource('Pod', pod)

    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      pod = event.payload.pod
    })

    const controller = createPodLifecycleController(apiServer, {
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
    expect(pod.status.containerStatuses?.[0]?.stateDetails?.reason).toBe(
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

  it('does not restart command-driven crashing pod when restartPolicy is Never', () => {
    vi.useFakeTimers()
    const apiServer = createApiServerFacade()
    const eventBus = apiServer.eventBus
    let pod: Pod = createPod({
      name: 'no-restart-nginx',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      restartPolicy: 'Never',
      containers: [
        {
          name: 'busybox',
          image: 'busybox:1.36',
          args: ['sh', '-c', 'exit 1']
        }
      ]
    })
    apiServer.createResource('Pod', pod)

    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      pod = event.payload.pod
    })

    const controller = createPodLifecycleController(apiServer)
    controller.reconcile('default/no-restart-nginx')

    expect(pod.status.phase).toBe('Failed')
    expect(pod.status.containerStatuses?.[0]?.stateDetails?.state).toBe('Terminated')
    expect(pod.status.containerStatuses?.[0]?.stateDetails?.reason).toBe('Error')
    expect(pod.status.containerStatuses?.[0]?.lastStateDetails).toBeDefined()
    expect(pod.status.containerStatuses?.[0]?.restartCount).toBe(0)

    vi.runOnlyPendingTimers()
    expect(pod.status.containerStatuses?.[0]?.restartCount).toBe(0)

    controller.stop()
  })

  it('restarts command-driven crashing pod when restartPolicy is OnFailure', () => {
    vi.useFakeTimers()
    const apiServer = createApiServerFacade()
    const eventBus = apiServer.eventBus
    let pod: Pod = createPod({
      name: 'onfailure-crashy',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      restartPolicy: 'OnFailure',
      containers: [
        {
          name: 'busybox',
          image: 'busybox:1.36',
          args: ['sh', '-c', 'exit 1']
        }
      ]
    })
    apiServer.createResource('Pod', pod)

    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      pod = event.payload.pod
    })

    const controller = createPodLifecycleController(apiServer, {
      restartBackoffMs: {
        initialMs: 10,
        maxMs: 40
      },
      crashLoopTimingMs: {
        errorToBackoffMs: 0
      }
    })
    controller.reconcile('default/onfailure-crashy')

    expect(pod.status.containerStatuses?.[0]?.stateDetails?.reason).toBe(
      'CrashLoopBackOff'
    )
    expect(pod.status.containerStatuses?.[0]?.restartCount).toBe(1)

    vi.advanceTimersByTime(10)
    vi.runOnlyPendingTimers()
    expect(pod.status.containerStatuses?.[0]?.restartCount).toBe(2)

    controller.stop()
  })

  it('transitions command-driven success pod to Succeeded with OnFailure policy', () => {
    vi.useFakeTimers()
    const apiServer = createApiServerFacade()
    const eventBus = apiServer.eventBus
    let pod: Pod = createPod({
      name: 'onfailure-success',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      restartPolicy: 'OnFailure',
      containers: [
        {
          name: 'busybox',
          image: 'busybox:1.36',
          args: ['sh', '-c', 'exit 0']
        }
      ]
    })
    apiServer.createResource('Pod', pod)

    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      pod = event.payload.pod
    })

    const controller = createPodLifecycleController(apiServer, {
      pendingDelayRangeMs: {
        minMs: 0,
        maxMs: 0
      },
      completionDelayRangeMs: {
        minMs: 5,
        maxMs: 5
      }
    })

    controller.reconcile('default/onfailure-success')
    expect(pod.status.phase).toBe('Running')

    vi.advanceTimersByTime(5)
    vi.runOnlyPendingTimers()

    expect(pod.status.phase).toBe('Succeeded')
    expect(pod.status.containerStatuses?.[0]?.stateDetails?.reason).toBe(
      'Completed'
    )
    expect(pod.status.containerStatuses?.[0]?.stateDetails?.exitCode).toBe(0)
    expect(pod.status.containerStatuses?.[0]?.restartCount).toBe(0)

    controller.stop()
  })

  it('transitions busybox pod from Running to Succeeded with Completed reason', () => {
    vi.useFakeTimers()
    const apiServer = createApiServerFacade()
    const eventBus = apiServer.eventBus
    let pod: Pod = createPod({
      name: 'success-pod',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      restartPolicy: 'Never',
      containers: [{ name: 'busybox', image: 'busybox:1.36' }]
    })
    apiServer.createResource('Pod', pod)

    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      pod = event.payload.pod
    })

    const controller = createPodLifecycleController(apiServer, {
      pendingDelayRangeMs: {
        minMs: 0,
        maxMs: 0
      },
      completionDelayRangeMs: {
        minMs: 5,
        maxMs: 5
      }
    })

    controller.reconcile('default/success-pod')
    expect(pod.status.phase).toBe('Running')

    vi.advanceTimersByTime(5)
    vi.runOnlyPendingTimers()

    expect(pod.status.phase).toBe('Succeeded')
    expect(pod.status.containerStatuses?.[0]?.stateDetails?.state).toBe('Terminated')
    expect(pod.status.containerStatuses?.[0]?.stateDetails?.reason).toBe('Completed')
    expect(pod.status.containerStatuses?.[0]?.stateDetails?.exitCode).toBe(0)

    controller.stop()
  })

  it('clears success completion timer when pod is deleted before completion', () => {
    vi.useFakeTimers()
    const apiServer = createApiServerFacade()
    const eventBus = apiServer.eventBus
    let pod: Pod = createPod({
      name: 'success-delete',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'conformance-worker',
      restartPolicy: 'Never',
      containers: [{ name: 'busybox', image: 'busybox:1.36' }]
    })
    apiServer.createResource('Pod', pod)

    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      pod = event.payload.pod
    })

    const controller = createPodLifecycleController(apiServer, {
      pendingDelayRangeMs: {
        minMs: 0,
        maxMs: 0
      },
      completionDelayRangeMs: {
        minMs: 25,
        maxMs: 25
      }
    })

    controller.reconcile('default/success-delete')
    expect(pod.status.phase).toBe('Running')

    eventBus.emit(
      createPodDeletedEvent(
        pod.metadata.name,
        pod.metadata.namespace,
        pod,
        'test'
      )
    )

    vi.advanceTimersByTime(30)
    vi.runOnlyPendingTimers()

    expect(pod.status.phase).toBe('Running')
    expect(pod.status.containerStatuses?.[0]?.stateDetails?.reason).toBeUndefined()

    controller.stop()
  })
})
