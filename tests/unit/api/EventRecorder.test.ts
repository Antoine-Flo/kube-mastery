import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../src/core/api/ApiServerFacade'
import { createEventRecorder } from '../../../src/core/api/EventRecorder'
import { createEventBus } from '../../../src/core/cluster/events/EventBus'
import {
  createPersistentVolumeClaimLifecycleEvent,
  createPodBoundEvent,
  createPodVolumeLifecycleEvent
} from '../../../src/core/cluster/events/types'
import { createEvent } from '../../../src/core/cluster/ressources/Event'
import { createPod } from '../../../src/core/cluster/ressources/Pod'

describe('EventRecorder', () => {
  it('records a Scheduled event for PodBound cluster event', () => {
    const eventBus = createEventBus()
    const apiServer = createApiServerFacade({
      eventBus,
      eventRecorder: { enabled: false }
    })
    const recorder = createEventRecorder(apiServer, eventBus)
    recorder.start()

    const pod = createPod({
      name: 'web',
      namespace: 'default',
      containers: [{ name: 'web', image: 'nginx:1.28' }]
    })
    apiServer.emitEvent(
      createPodBoundEvent('web', 'default', 'worker-a', pod, pod, 'default-scheduler')
    )

    const events = apiServer.listResources('Event')
    expect(events.length).toBe(1)
    expect(events[0].reason).toBe('Scheduled')
    expect(events[0].message).toContain('Successfully assigned default/web')
    expect(events[0].involvedObject.kind).toBe('Pod')

    recorder.stop()
    apiServer.stop()
  })

  it('aggregates repeated events and increments count', () => {
    const eventBus = createEventBus()
    const apiServer = createApiServerFacade({
      eventBus,
      eventRecorder: { enabled: false }
    })
    const recorder = createEventRecorder(apiServer, eventBus)
    recorder.start()

    const pod = createPod({
      name: 'api',
      namespace: 'default',
      containers: [{ name: 'api', image: 'nginx:1.28' }]
    })
    apiServer.emitEvent(
      createPodBoundEvent('api', 'default', 'worker-a', pod, pod, 'default-scheduler')
    )
    apiServer.emitEvent(
      createPodBoundEvent('api', 'default', 'worker-a', pod, pod, 'default-scheduler')
    )

    const events = apiServer.listResources('Event')
    expect(events.length).toBe(1)
    expect(events[0].count).toBe(2)

    recorder.stop()
    apiServer.stop()
  })

  it('ignores events emitted from api-server source', () => {
    const eventBus = createEventBus()
    const apiServer = createApiServerFacade({
      eventBus,
      eventRecorder: { enabled: false }
    })
    const recorder = createEventRecorder(apiServer, eventBus)
    recorder.start()

    const pod = createPod({
      name: 'api',
      namespace: 'default',
      containers: [{ name: 'api', image: 'nginx:1.28' }]
    })
    apiServer.emitEvent(
      createPodBoundEvent('api', 'default', 'worker-a', pod, pod, 'api-server')
    )

    const events = apiServer.listResources('Event')
    expect(events).toHaveLength(0)

    recorder.stop()
    apiServer.stop()
  })

  it('cleans up expired events during resync', () => {
    const eventBus = createEventBus()
    const fixedNow = new Date('2026-04-07T10:00:00.000Z')
    const apiServer = createApiServerFacade({
      eventBus,
      eventRecorder: { enabled: false }
    })
    const recorder = createEventRecorder(apiServer, eventBus, {
      eventTtlMs: 60 * 1000,
      now: () => fixedNow
    })

    apiServer.createResource(
      'Event',
      createEvent({
        name: 'expired.1',
        namespace: 'default',
        involvedObject: {
          apiVersion: 'v1',
          kind: 'Pod',
          name: 'expired',
          namespace: 'default'
        },
        reason: 'Started',
        message: 'Started pod default/expired',
        firstTimestamp: '2026-04-07T09:00:00.000Z',
        lastTimestamp: '2026-04-07T09:00:00.000Z',
        creationTimestamp: '2026-04-07T09:00:00.000Z'
      }),
      'default'
    )

    recorder.resyncAll()

    const events = apiServer.listResources('Event')
    expect(events).toHaveLength(0)
    apiServer.stop()
  })

  it('records Warning FailedBinding from pvc lifecycle event', () => {
    const eventBus = createEventBus()
    const apiServer = createApiServerFacade({
      eventBus,
      eventRecorder: { enabled: false }
    })
    const recorder = createEventRecorder(apiServer, eventBus)
    recorder.start()

    apiServer.emitEvent(
      createPersistentVolumeClaimLifecycleEvent(
        'default',
        'data',
        'FailedBinding',
        'no persistent volumes available for this claim and no storage class is set',
        'Warning',
        'persistentvolume-controller'
      )
    )

    const events = apiServer.listResources('Event')
    expect(events).toHaveLength(1)
    expect(events[0].involvedObject.kind).toBe('PersistentVolumeClaim')
    expect(events[0].reason).toBe('FailedBinding')
    expect(events[0].type).toBe('Warning')

    recorder.stop()
    apiServer.stop()
  })

  it('records Warning FailedMount from pod lifecycle event', () => {
    const eventBus = createEventBus()
    const apiServer = createApiServerFacade({
      eventBus,
      eventRecorder: { enabled: false }
    })
    const recorder = createEventRecorder(apiServer, eventBus)
    recorder.start()

    apiServer.emitEvent(
      createPodVolumeLifecycleEvent(
        'default',
        'app',
        'FailedMount',
        'Unable to attach or mount volumes: timed out waiting for condition',
        'Warning',
        'kubelet'
      )
    )

    const events = apiServer.listResources('Event')
    expect(events).toHaveLength(1)
    expect(events[0].involvedObject.kind).toBe('Pod')
    expect(events[0].reason).toBe('FailedMount')
    expect(events[0].type).toBe('Warning')

    recorder.stop()
    apiServer.stop()
  })
})
