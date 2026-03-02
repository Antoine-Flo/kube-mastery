import { afterEach, describe, expect, it, vi } from 'vitest'
import { createEventBus } from '../../../src/core/cluster/events/EventBus'
import {
  createPodBoundEvent,
  createPodUpdatedEvent,
  type PodUpdatedEvent
} from '../../../src/core/cluster/events/types'
import { createPod } from '../../../src/core/cluster/ressources/Pod'
import { createPodStartupSimulator } from '../../../src/core/cluster/podStartupSimulator'

describe('podStartupSimulator', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('transitions pending scheduled pod to running on PodBound', () => {
    vi.useFakeTimers()
    const eventBus = createEventBus()
    const simulator = createPodStartupSimulator(
      eventBus,
      () =>
        ({
          getPods: () => []
        }) as never,
      {
        pendingDelayRangeMs: {
          minMs: 0,
          maxMs: 0
        }
      }
    )

    const pendingPod = createPod({
      name: 'nginx',
      namespace: 'default',
      phase: 'Pending',
      containers: [{ name: 'nginx', image: 'nginx:latest' }]
    })
    const scheduledPendingPod = createPod({
      ...pendingPod.metadata,
      name: pendingPod.metadata.name,
      namespace: pendingPod.metadata.namespace,
      phase: 'Pending',
      nodeName: 'sim-worker',
      containers: [{ name: 'nginx', image: 'nginx:latest' }]
    })

    const emittedBySimulator: PodUpdatedEvent[] = []
    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      if (event.metadata?.source === 'pod-startup-simulator') {
        emittedBySimulator.push(event)
      }
    })

    simulator.start()
    eventBus.emit(
      createPodBoundEvent(
        pendingPod.metadata.name,
        pendingPod.metadata.namespace,
        'sim-worker',
        scheduledPendingPod,
        pendingPod,
        'scheduler'
      )
    )
    vi.runAllTimers()

    expect(emittedBySimulator.length).toBe(2)
    expect(emittedBySimulator[0].payload.pod.status.phase).toBe('Pending')
    expect(emittedBySimulator[0].payload.pod.status.containerStatuses?.[0]?.waitingReason).toBe(
      'ContainerCreating'
    )
    expect(emittedBySimulator[1].payload.pod.status.phase).toBe('Running')
  })

  it('does not transition pending unscheduled pod to running', () => {
    vi.useFakeTimers()
    const eventBus = createEventBus()
    const pendingUnscheduledPod = createPod({
      name: 'nginx',
      namespace: 'default',
      phase: 'Pending',
      containers: [{ name: 'nginx', image: 'nginx:latest' }]
    })
    const simulator = createPodStartupSimulator(
      eventBus,
      () =>
        ({
          getPods: () => [pendingUnscheduledPod]
        }) as never,
      {
        pendingDelayRangeMs: {
          minMs: 0,
          maxMs: 0
        }
      }
    )

    const emittedBySimulator: PodUpdatedEvent[] = []
    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      if (event.metadata?.source === 'pod-startup-simulator') {
        emittedBySimulator.push(event)
      }
    })

    simulator.start()
    eventBus.emit(
      createPodUpdatedEvent(
        pendingUnscheduledPod.metadata.name,
        pendingUnscheduledPod.metadata.namespace,
        pendingUnscheduledPod,
        pendingUnscheduledPod,
        'scheduler'
      )
    )
    vi.runAllTimers()

    expect(emittedBySimulator).toHaveLength(0)
  })

  it('does not transition when PodBound payload has no nodeName on pod', () => {
    vi.useFakeTimers()
    const eventBus = createEventBus()
    const pendingUnscheduledPod = createPod({
      name: 'nginx',
      namespace: 'default',
      phase: 'Pending',
      containers: [{ name: 'nginx', image: 'nginx:latest' }]
    })
    const simulator = createPodStartupSimulator(
      eventBus,
      () =>
        ({
          getPods: () => []
        }) as never,
      {
        pendingDelayRangeMs: {
          minMs: 0,
          maxMs: 0
        }
      }
    )

    const emittedBySimulator: PodUpdatedEvent[] = []
    eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
      if (event.metadata?.source === 'pod-startup-simulator') {
        emittedBySimulator.push(event)
      }
    })

    simulator.start()
    eventBus.emit(
      createPodBoundEvent(
        pendingUnscheduledPod.metadata.name,
        pendingUnscheduledPod.metadata.namespace,
        'sim-worker',
        pendingUnscheduledPod,
        pendingUnscheduledPod,
        'scheduler'
      )
    )
    vi.runAllTimers()

    expect(emittedBySimulator).toHaveLength(0)
  })
})
