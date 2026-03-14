import { describe, expect, it } from 'vitest'
import { createEventBus } from '../../../src/core/cluster/events/EventBus'
import { createEtcdLikeStore } from '../../../src/core/etcd/EtcdLikeStore'
import {
  createPodBoundEvent,
  createPodDeletedEvent,
  createPodUpdatedEvent
} from '../../../src/core/cluster/events/types'
import { createPod } from '../../../src/core/cluster/ressources/Pod'
import { createPodLifecycleEventStore } from '../../../src/core/api/PodLifecycleEventStore'

describe('PodLifecycleEventStore', () => {
  it('captures scheduled, start and warning pod lifecycle events', () => {
    const eventBus = createEventBus()
    const etcd = createEtcdLikeStore(eventBus)
    const store = createPodLifecycleEventStore(etcd)

    const basePod = createPod({
      name: 'api-pod',
      namespace: 'default',
      nodeName: 'worker-a',
      phase: 'Pending',
      containers: [{ name: 'api', image: 'nginx:1.28' }]
    })

    const runningPod = {
      ...basePod,
      status: {
        ...basePod.status,
        phase: 'Running' as const,
        containerStatuses: (basePod.status.containerStatuses ?? []).map(
          (status) => {
            return {
              ...status,
              ready: true,
              stateDetails: {
                state: 'Running' as const,
                startedAt: '2026-03-13T10:00:00.000Z'
              }
            }
          }
        )
      }
    }

    const crashLoopPod = {
      ...runningPod,
      status: {
        ...runningPod.status,
        phase: 'Pending' as const,
        containerStatuses: (runningPod.status.containerStatuses ?? []).map(
          (status) => {
            return {
              ...status,
              ready: false,
              restartCount: status.restartCount + 1,
              stateDetails: {
                state: 'Waiting' as const,
                reason: 'CrashLoopBackOff'
              }
            }
          }
        )
      }
    }

    etcd.appendEvent(
      createPodBoundEvent(
        basePod.metadata.name,
        basePod.metadata.namespace,
        'worker-a',
        basePod,
        basePod,
        'test'
      )
    )
    etcd.appendEvent(
      createPodUpdatedEvent(
        runningPod.metadata.name,
        runningPod.metadata.namespace,
        runningPod,
        basePod,
        'test'
      )
    )
    etcd.appendEvent(
      createPodUpdatedEvent(
        crashLoopPod.metadata.name,
        crashLoopPod.metadata.namespace,
        crashLoopPod,
        runningPod,
        'test'
      )
    )

    const events = store.listPodEvents('default', 'api-pod')
    const reasons = events.map((event) => {
      return event.reason
    })
    const messages = events.map((event) => {
      return event.message
    })

    expect(reasons).toEqual([
      'Scheduled',
      'Pulled',
      'Created',
      'Started',
      'BackOff'
    ])
    expect(messages.some((message) => message.includes('Successfully assigned'))).toBe(
      true
    )
    expect(
      messages.some((message) =>
        message.includes('Back-off restarting failed container')
      )
    ).toBe(true)
    etcd.dispose()
  })

  it('stops subscriptions safely when stopped multiple times', () => {
    const eventBus = createEventBus()
    const etcd = createEtcdLikeStore(eventBus)
    const store = createPodLifecycleEventStore(etcd)
    store.stop()
    store.stop()
    expect(store.listPodEvents('default', 'missing')).toEqual([])
    etcd.dispose()
  })

  it('captures terminated events and clears pod history on deletion', () => {
    const eventBus = createEventBus()
    const etcd = createEtcdLikeStore(eventBus)
    const store = createPodLifecycleEventStore(etcd)

    const runningPod = createPod({
      name: 'worker-pod',
      namespace: 'default',
      nodeName: 'worker-a',
      phase: 'Running',
      containers: [{ name: 'worker', image: 'busybox:latest' }]
    })

    const failedPod = {
      ...runningPod,
      status: {
        ...runningPod.status,
        phase: 'Pending' as const,
        containerStatuses: (runningPod.status.containerStatuses ?? []).map(
          (status) => {
            return {
              ...status,
              ready: false,
              stateDetails: {
                state: 'Terminated' as const,
                reason: 'Error',
                exitCode: 1
              }
            }
          }
        )
      }
    }

    etcd.appendEvent(
      createPodUpdatedEvent(
        failedPod.metadata.name,
        failedPod.metadata.namespace,
        failedPod,
        runningPod,
        'test'
      )
    )

    const beforeDelete = store.listPodEvents('default', 'worker-pod')
    expect(beforeDelete.map((event) => event.reason)).toEqual([
      'Killing',
      'Failed'
    ])

    etcd.appendEvent(
      createPodDeletedEvent(
        failedPod.metadata.name,
        failedPod.metadata.namespace,
        failedPod,
        'test'
      )
    )
    expect(store.listPodEvents('default', 'worker-pod')).toEqual([])
    etcd.dispose()
  })
})
