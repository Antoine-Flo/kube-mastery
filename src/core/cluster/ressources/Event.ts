import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import { z } from 'zod'
import type { KubernetesResource } from '../repositories/types'

export interface EventInvolvedObject {
  apiVersion: string
  kind: string
  name: string
  namespace?: string
  uid?: string
  resourceVersion?: string
  fieldPath?: string
}

interface EventMetadata {
  name: string
  namespace: string
  creationTimestamp: string
  resourceVersion?: string
  uid?: string
}

export interface Event extends KubernetesResource {
  apiVersion: 'v1'
  kind: 'Event'
  metadata: EventMetadata
  involvedObject: EventInvolvedObject
  reason: string
  message: string
  type: 'Normal' | 'Warning'
  count: number
  firstTimestamp: string
  lastTimestamp: string
  eventTime?: string | null
  reportingController?: string
  reportingInstance?: string
  action?: string
}

export interface EventsV1Event {
  apiVersion: 'events.k8s.io/v1'
  kind: 'Event'
  metadata: EventMetadata
  regarding: EventInvolvedObject
  note: string
  reason: string
  type: 'Normal' | 'Warning'
  action?: string
  eventTime: string | null
  reportingController?: string
  reportingInstance?: string
  series?: {
    count: number
    lastObservedTime: string
  }
}

interface EventConfig {
  name: string
  namespace: string
  involvedObject: EventInvolvedObject
  reason: string
  message: string
  type?: 'Normal' | 'Warning'
  count?: number
  firstTimestamp?: string
  lastTimestamp?: string
  creationTimestamp?: string
  resourceVersion?: string
  uid?: string
  eventTime?: string | null
  reportingController?: string
  reportingInstance?: string
  action?: string
}

export const createEvent = (config: EventConfig): Event => {
  const nowTimestamp = new Date().toISOString()
  const firstTimestamp = config.firstTimestamp ?? nowTimestamp
  const lastTimestamp = config.lastTimestamp ?? firstTimestamp
  const creationTimestamp = config.creationTimestamp ?? firstTimestamp
  const event: Event = {
    apiVersion: 'v1',
    kind: 'Event',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp,
      ...(config.resourceVersion != null
        ? { resourceVersion: config.resourceVersion }
        : {}),
      ...(config.uid != null ? { uid: config.uid } : {})
    },
    involvedObject: config.involvedObject,
    reason: config.reason,
    message: config.message,
    type: config.type ?? 'Normal',
    count: config.count ?? 1,
    firstTimestamp,
    lastTimestamp,
    ...(config.eventTime !== undefined ? { eventTime: config.eventTime } : {}),
    ...(config.reportingController != null
      ? { reportingController: config.reportingController }
      : {}),
    ...(config.reportingInstance != null
      ? { reportingInstance: config.reportingInstance }
      : {}),
    ...(config.action != null ? { action: config.action } : {})
  }
  return deepFreeze(event)
}

const resolveEventTime = (event: Event): string | null => {
  if (event.eventTime !== undefined) {
    return event.eventTime
  }
  if (event.lastTimestamp.length > 0) {
    return event.lastTimestamp
  }
  return null
}

export const convertCoreEventToEventsV1 = (event: Event): EventsV1Event => {
  const eventTime = resolveEventTime(event)
  const hasSeries = event.count > 1
  return deepFreeze({
    apiVersion: 'events.k8s.io/v1',
    kind: 'Event',
    metadata: event.metadata,
    regarding: event.involvedObject,
    note: event.message,
    reason: event.reason,
    type: event.type,
    ...(event.action != null ? { action: event.action } : {}),
    eventTime,
    ...(event.reportingController != null
      ? { reportingController: event.reportingController }
      : {}),
    ...(event.reportingInstance != null
      ? { reportingInstance: event.reportingInstance }
      : {}),
    ...(hasSeries
      ? {
          series: {
            count: event.count,
            lastObservedTime: event.lastTimestamp
          }
        }
      : {})
  })
}

export const convertEventsV1ToCoreEvent = (event: EventsV1Event): Event => {
  const seriesCount = event.series?.count
  const seriesLastObservedTime = event.series?.lastObservedTime
  const resolvedLastTimestamp =
    seriesLastObservedTime ??
    (event.eventTime != null ? event.eventTime : event.metadata.creationTimestamp)
  const resolvedFirstTimestamp =
    event.metadata.creationTimestamp.length > 0
      ? event.metadata.creationTimestamp
      : resolvedLastTimestamp
  return createEvent({
    name: event.metadata.name,
    namespace: event.metadata.namespace,
    involvedObject: event.regarding,
    reason: event.reason,
    message: event.note,
    type: event.type,
    count: seriesCount ?? 1,
    firstTimestamp: resolvedFirstTimestamp,
    lastTimestamp: resolvedLastTimestamp,
    creationTimestamp: event.metadata.creationTimestamp,
    resourceVersion: event.metadata.resourceVersion,
    uid: event.metadata.uid,
    eventTime: event.eventTime,
    reportingController: event.reportingController,
    reportingInstance: event.reportingInstance,
    action: event.action
  })
}

const EventInvolvedObjectSchema = z.object({
  apiVersion: z.string().default('v1'),
  kind: z.string().min(1),
  name: z.string().min(1),
  namespace: z.string().optional()
})

const EventManifestSchema = z.object({
  apiVersion: z.literal('v1'),
  kind: z.literal('Event'),
  metadata: z.object({
    name: z.string().min(1, 'Event name is required'),
    namespace: z.string().default('default'),
    creationTimestamp: z.string().optional(),
    resourceVersion: z.string().optional(),
    uid: z.string().optional()
  }),
  involvedObject: EventInvolvedObjectSchema,
  reason: z.string().min(1, 'Event reason is required'),
  message: z.string().min(1, 'Event message is required'),
  type: z.enum(['Normal', 'Warning']).optional(),
  count: z.number().int().positive().optional(),
  firstTimestamp: z.string().optional(),
  lastTimestamp: z.string().optional(),
  eventTime: z.string().nullable().optional(),
  reportingController: z.string().optional(),
  reportingInstance: z.string().optional(),
  action: z.string().optional()
})

export const parseEventManifest = (data: unknown): Result<Event> => {
  const parseResult = EventManifestSchema.safeParse(data)
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0]
    return error(
      `Invalid Event manifest: ${firstIssue.path.join('.')}: ${firstIssue.message}`
    )
  }
  const manifest = parseResult.data
  return success(
    createEvent({
      name: manifest.metadata.name,
      namespace: manifest.metadata.namespace,
      involvedObject: manifest.involvedObject,
      reason: manifest.reason,
      message: manifest.message,
      type: manifest.type,
      count: manifest.count,
      firstTimestamp: manifest.firstTimestamp,
      lastTimestamp: manifest.lastTimestamp,
      creationTimestamp: manifest.metadata.creationTimestamp,
      resourceVersion: manifest.metadata.resourceVersion,
      uid: manifest.metadata.uid,
      eventTime: manifest.eventTime,
      reportingController: manifest.reportingController,
      reportingInstance: manifest.reportingInstance,
      action: manifest.action
    })
  )
}
