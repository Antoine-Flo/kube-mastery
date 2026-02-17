import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createEventBus,
  type EventBus
} from '../../../../src/core/cluster/events/EventBus'
import {
  createPodCreatedEvent,
  type PodUpdatedEvent
} from '../../../../src/core/cluster/events/types'
import {
  createNode,
  type Node
} from '../../../../src/core/cluster/ressources/Node'
import {
  createPod,
  type Pod
} from '../../../../src/core/cluster/ressources/Pod'
import {
  createScheduler,
  type Scheduler,
  type SchedulerState
} from '../../../../src/core/cluster/scheduler'

describe('Scheduler', () => {
  let eventBus: EventBus
  let scheduler: Scheduler
  let mockState: {
    nodes: Node[]
    pods: Pod[]
  }
  let getState: () => SchedulerState

  const createReadyNode = (name: string): Node => {
    return createNode({
      name,
      status: {
        nodeInfo: {
          architecture: 'amd64',
          containerRuntimeVersion: 'containerd://1.6.0',
          kernelVersion: '5.15.0',
          kubeletVersion: 'v1.28.0',
          operatingSystem: 'linux',
          osImage: 'Ubuntu 22.04'
        },
        conditions: [
          {
            type: 'Ready',
            status: 'True'
          }
        ]
      }
    })
  }

  const createNotReadyNode = (name: string): Node => {
    return createNode({
      name,
      status: {
        nodeInfo: {
          architecture: 'amd64',
          containerRuntimeVersion: 'containerd://1.6.0',
          kernelVersion: '5.15.0',
          kubeletVersion: 'v1.28.0',
          operatingSystem: 'linux',
          osImage: 'Ubuntu 22.04'
        },
        conditions: [
          {
            type: 'Ready',
            status: 'False'
          }
        ]
      }
    })
  }

  const createCordonedNode = (name: string): Node => {
    return createNode({
      name,
      spec: {
        unschedulable: true
      },
      status: {
        nodeInfo: {
          architecture: 'amd64',
          containerRuntimeVersion: 'containerd://1.6.0',
          kernelVersion: '5.15.0',
          kubeletVersion: 'v1.28.0',
          operatingSystem: 'linux',
          osImage: 'Ubuntu 22.04'
        },
        conditions: [
          {
            type: 'Ready',
            status: 'True'
          }
        ]
      }
    })
  }

  const createUnscheduledPod = (name: string): Pod => {
    return createPod({
      name,
      namespace: 'default',
      containers: [{ name: 'nginx', image: 'nginx:latest' }],
      phase: 'Pending'
    })
  }

  const createScheduledPod = (name: string, nodeName: string): Pod => {
    return createPod({
      name,
      namespace: 'default',
      containers: [{ name: 'nginx', image: 'nginx:latest' }],
      nodeName,
      phase: 'Running'
    })
  }

  beforeEach(() => {
    eventBus = createEventBus()
    mockState = {
      nodes: [],
      pods: []
    }

    getState = () => ({
      getNodes: () => mockState.nodes,
      getPods: (namespace?: string) =>
        namespace
          ? mockState.pods.filter((p) => p.metadata.namespace === namespace)
          : mockState.pods,
      findPod: (name: string, namespace: string) => {
        const pod = mockState.pods.find(
          (p) => p.metadata.name === name && p.metadata.namespace === namespace
        )
        return pod
          ? { ok: true, value: pod }
          : { ok: false, error: 'not found' }
      }
    })

    scheduler = createScheduler(eventBus, getState)
  })

  describe('scheduling', () => {
    it('should schedule a pod to a Ready node', () => {
      mockState.nodes = [createReadyNode('node-1')]
      scheduler.start()

      let updatedPod: Pod | undefined
      eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
        updatedPod = event.payload.pod
      })

      const pod = createUnscheduledPod('test-pod')
      eventBus.emit(createPodCreatedEvent(pod, 'test'))

      expect(updatedPod).toBeDefined()
      expect(updatedPod!.spec.nodeName).toBe('node-1')
      // Scheduler only assigns nodeName; phase stays Pending until PodStartupSimulator transitions
      expect(updatedPod!.status.phase).toBe('Pending')
    })

    it('should not schedule a pod that already has a nodeName', () => {
      mockState.nodes = [createReadyNode('node-1')]
      scheduler.start()

      const podUpdated = vi.fn()
      eventBus.subscribe('PodUpdated', podUpdated)

      const pod = createScheduledPod('test-pod', 'node-1')
      eventBus.emit(createPodCreatedEvent(pod, 'test'))

      expect(podUpdated).not.toHaveBeenCalled()
    })

    it('should not schedule when no nodes are available', () => {
      mockState.nodes = []
      scheduler.start()

      const podUpdated = vi.fn()
      eventBus.subscribe('PodUpdated', podUpdated)

      const pod = createUnscheduledPod('test-pod')
      eventBus.emit(createPodCreatedEvent(pod, 'test'))

      expect(podUpdated).not.toHaveBeenCalled()
    })

    it('should not schedule to a NotReady node', () => {
      mockState.nodes = [createNotReadyNode('node-1')]
      scheduler.start()

      const podUpdated = vi.fn()
      eventBus.subscribe('PodUpdated', podUpdated)

      const pod = createUnscheduledPod('test-pod')
      eventBus.emit(createPodCreatedEvent(pod, 'test'))

      expect(podUpdated).not.toHaveBeenCalled()
    })

    it('should not schedule to a cordoned node', () => {
      mockState.nodes = [createCordonedNode('node-1')]
      scheduler.start()

      const podUpdated = vi.fn()
      eventBus.subscribe('PodUpdated', podUpdated)

      const pod = createUnscheduledPod('test-pod')
      eventBus.emit(createPodCreatedEvent(pod, 'test'))

      expect(podUpdated).not.toHaveBeenCalled()
    })

    it('should skip NotReady nodes and schedule to Ready nodes', () => {
      mockState.nodes = [
        createNotReadyNode('node-bad'),
        createReadyNode('node-good')
      ]
      scheduler.start()

      let updatedPod: Pod | undefined
      eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
        updatedPod = event.payload.pod
      })

      const pod = createUnscheduledPod('test-pod')
      eventBus.emit(createPodCreatedEvent(pod, 'test'))

      expect(updatedPod).toBeDefined()
      expect(updatedPod!.spec.nodeName).toBe('node-good')
    })

    it('should use round-robin to distribute pods across nodes', () => {
      mockState.nodes = [
        createReadyNode('node-1'),
        createReadyNode('node-2'),
        createReadyNode('node-3')
      ]
      scheduler.start()

      const scheduledNodes: string[] = []
      eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
        scheduledNodes.push(event.payload.pod.spec.nodeName!)
      })

      // Schedule 6 pods
      for (let i = 0; i < 6; i++) {
        const pod = createUnscheduledPod(`pod-${i}`)
        eventBus.emit(createPodCreatedEvent(pod, 'test'))
      }

      // Should distribute evenly: node-1, node-2, node-3, node-1, node-2, node-3
      expect(scheduledNodes).toEqual([
        'node-1',
        'node-2',
        'node-3',
        'node-1',
        'node-2',
        'node-3'
      ])
    })

    it('should not process events from scheduler source (avoid loops)', () => {
      mockState.nodes = [createReadyNode('node-1')]
      scheduler.start()

      const podUpdated = vi.fn()
      eventBus.subscribe('PodUpdated', podUpdated)

      const pod = createUnscheduledPod('test-pod')
      eventBus.emit(createPodCreatedEvent(pod, 'scheduler'))

      expect(podUpdated).not.toHaveBeenCalled()
    })
  })

  describe('start and stop', () => {
    it('should schedule existing unscheduled pods on start', () => {
      mockState.nodes = [createReadyNode('node-1')]
      mockState.pods = [createUnscheduledPod('existing-pod')]

      const podUpdated = vi.fn()
      eventBus.subscribe('PodUpdated', podUpdated)

      scheduler.start()

      expect(podUpdated).toHaveBeenCalledTimes(1)
      const event = podUpdated.mock.calls[0][0] as PodUpdatedEvent
      expect(event.payload.pod.metadata.name).toBe('existing-pod')
      expect(event.payload.pod.spec.nodeName).toBe('node-1')
    })

    it('should not re-schedule existing already bound pods on start', () => {
      mockState.nodes = [createReadyNode('node-1')]
      mockState.pods = [createScheduledPod('existing-pod', 'node-1')]

      const podUpdated = vi.fn()
      eventBus.subscribe('PodUpdated', podUpdated)

      scheduler.start()

      expect(podUpdated).not.toHaveBeenCalled()
    })

    it('should start listening for events', () => {
      mockState.nodes = [createReadyNode('node-1')]

      const podUpdated = vi.fn()
      eventBus.subscribe('PodUpdated', podUpdated)

      // Before start - should not process
      const pod1 = createUnscheduledPod('pod-1')
      eventBus.emit(createPodCreatedEvent(pod1, 'test'))
      expect(podUpdated).not.toHaveBeenCalled()

      // After start - should process
      scheduler.start()
      const pod2 = createUnscheduledPod('pod-2')
      eventBus.emit(createPodCreatedEvent(pod2, 'test'))
      expect(podUpdated).toHaveBeenCalledTimes(1)
    })

    it('should stop listening for events after stop()', () => {
      mockState.nodes = [createReadyNode('node-1')]
      scheduler.start()

      const podUpdated = vi.fn()
      eventBus.subscribe('PodUpdated', podUpdated)

      // Should process before stop
      const pod1 = createUnscheduledPod('pod-1')
      eventBus.emit(createPodCreatedEvent(pod1, 'test'))
      expect(podUpdated).toHaveBeenCalledTimes(1)

      // Stop scheduler
      scheduler.stop()

      // Should not process after stop
      const pod2 = createUnscheduledPod('pod-2')
      eventBus.emit(createPodCreatedEvent(pod2, 'test'))
      expect(podUpdated).toHaveBeenCalledTimes(1) // Still 1, not 2
    })
  })

  describe('event metadata', () => {
    it('should emit PodUpdated with scheduler source', () => {
      mockState.nodes = [createReadyNode('node-1')]
      scheduler.start()

      let eventSource: string | undefined
      eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
        eventSource = event.metadata?.source
      })

      const pod = createUnscheduledPod('test-pod')
      eventBus.emit(createPodCreatedEvent(pod, 'test'))

      expect(eventSource).toBe('scheduler')
    })

    it('should include previous pod in PodUpdated event', () => {
      mockState.nodes = [createReadyNode('node-1')]
      scheduler.start()

      let previousPod: Pod | undefined
      eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
        previousPod = event.payload.previousPod
      })

      const pod = createUnscheduledPod('test-pod')
      eventBus.emit(createPodCreatedEvent(pod, 'test'))

      expect(previousPod).toBeDefined()
      expect(previousPod!.spec.nodeName).toBeUndefined()
      expect(previousPod!.status.phase).toBe('Pending')
    })
  })
})
