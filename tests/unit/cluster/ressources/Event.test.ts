import { describe, expect, it } from 'vitest'
import {
  convertCoreEventToEventsV1,
  convertEventsV1ToCoreEvent,
  createEvent
} from '../../../../src/core/cluster/ressources/Event'

describe('Event resource dual api conversion', () => {
  it('converts core v1 event to events.k8s.io/v1 event', () => {
    const coreEvent = createEvent({
      name: 'pod-started.1',
      namespace: 'default',
      involvedObject: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: 'web',
        namespace: 'default'
      },
      reason: 'Started',
      message: 'Started container web',
      count: 3,
      firstTimestamp: '2026-04-06T10:00:00Z',
      lastTimestamp: '2026-04-06T10:01:00Z',
      reportingComponent: 'kubelet',
      reportingInstance: 'worker-a'
    })

    const projected = convertCoreEventToEventsV1(coreEvent)

    expect(projected.apiVersion).toBe('events.k8s.io/v1')
    expect(projected.kind).toBe('Event')
    expect(projected.note).toBe('Started container web')
    expect(projected.regarding.kind).toBe('Pod')
    expect(projected.series?.count).toBe(3)
    expect(projected.series?.lastObservedTime).toBe('2026-04-06T10:01:00Z')
    expect(projected.reportingController).toBe('kubelet')
    expect(projected.reportingInstance).toBe('worker-a')
  })

  it('converts events.k8s.io/v1 event back to core v1 event', () => {
    const coreEvent = convertEventsV1ToCoreEvent({
      apiVersion: 'events.k8s.io/v1',
      kind: 'Event',
      metadata: {
        name: 'pod-failed.1',
        namespace: 'default',
        creationTimestamp: '2026-04-06T10:10:00Z'
      },
      regarding: {
        apiVersion: 'v1',
        kind: 'Pod',
        name: 'web',
        namespace: 'default'
      },
      note: 'Back-off restarting failed container',
      reason: 'BackOff',
      type: 'Warning',
      eventTime: '2026-04-06T10:11:00Z',
      series: {
        count: 2,
        lastObservedTime: '2026-04-06T10:12:00Z'
      }
    })

    expect(coreEvent.apiVersion).toBe('v1')
    expect(coreEvent.kind).toBe('Event')
    expect(coreEvent.message).toBe('Back-off restarting failed container')
    expect(coreEvent.reason).toBe('BackOff')
    expect(coreEvent.type).toBe('Warning')
    expect(coreEvent.count).toBe(2)
    expect(coreEvent.lastTimestamp).toBe('2026-04-06T10:12:00Z')
  })
})
