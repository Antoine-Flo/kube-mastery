import type { PersistentVolumeClaimLifecycleDescribeEvent } from '../../../api/PersistentVolumeClaimLifecycleEventStore'
import type { ClusterStateData } from '../../../cluster/ClusterState'
import type { PersistentVolumeClaim } from '../../../cluster/ressources/PersistentVolumeClaim'
import { formatAge } from '../../../shared/formatter'
import { formatLabels } from '../internal/helpers'

export const describePersistentVolumeClaim = (
  persistentVolumeClaim: PersistentVolumeClaim,
  state?: ClusterStateData,
  events: readonly PersistentVolumeClaimLifecycleDescribeEvent[] = []
): string => {
  const resolveUsedBy = (): string => {
    if (state == null) {
      return '<none>'
    }
    const namespace = persistentVolumeClaim.metadata.namespace
    const claimName = persistentVolumeClaim.metadata.name
    const consumerPods = state.pods.items
      .filter((pod) => {
        if (pod.metadata.namespace !== namespace) {
          return false
        }
        const volumes = pod.spec.volumes ?? []
        return volumes.some((volume) => {
          return (
            volume.source.type === 'persistentVolumeClaim' &&
            volume.source.claimName === claimName
          )
        })
      })
      .map((pod) => pod.metadata.name)
    if (consumerPods.length === 0) {
      return '<none>'
    }
    return consumerPods.join(',')
  }

  const resolveVolumeMode = (): string => {
    return 'Filesystem'
  }

  const resolveFinalizers = (): string => {
    return '[kubernetes.io/pvc-protection]'
  }

  const resolveEvents = (): string => {
    if (events.length === 0) {
      return 'Events:        <none>'
    }
    const groupedEvents = new Map<
      string,
      {
        type: string
        reason: string
        source: string
        message: string
        count: number
        firstTimestamp: string
        lastTimestamp: string
      }
    >()
    for (const event of events) {
      const key = `${event.type}|${event.reason}|${event.source}|${event.message}`
      const previous = groupedEvents.get(key)
      if (previous == null) {
        groupedEvents.set(key, {
          type: event.type,
          reason: event.reason,
          source: event.source,
          message: event.message,
          count: 1,
          firstTimestamp: event.timestamp,
          lastTimestamp: event.timestamp
        })
        continue
      }
      previous.count = previous.count + 1
      previous.lastTimestamp = event.timestamp
    }

    const formatDuration = (start: string, end: string): string => {
      const diffSeconds = Math.max(
        0,
        Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000)
      )
      if (diffSeconds < 60) {
        return `${diffSeconds}s`
      }
      const diffMinutes = Math.floor(diffSeconds / 60)
      if (diffMinutes < 60) {
        return `${diffMinutes}m`
      }
      const diffHours = Math.floor(diffMinutes / 60)
      if (diffHours < 24) {
        return `${diffHours}h`
      }
      return `${Math.floor(diffHours / 24)}d`
    }

    const formatEventAge = (event: {
      count: number
      firstTimestamp: string
      lastTimestamp: string
    }): string => {
      const latestAge = formatAge(event.lastTimestamp)
      if (event.count <= 1) {
        return latestAge
      }
      return `${latestAge} (x${event.count} over ${formatDuration(event.firstTimestamp, event.lastTimestamp)})`
    }

    const summarizedEvents = [...groupedEvents.values()]
      .sort((left, right) => {
        return (
          new Date(left.lastTimestamp).getTime() -
          new Date(right.lastTimestamp).getTime()
        )
      })
      .map((event) => {
        return {
          type: event.type,
          reason: event.reason,
          age: formatEventAge(event),
          source: event.source,
          message: event.message
        }
      })

    const typeWidth = Math.max(
      4,
      ...summarizedEvents.map((event) => event.type.length)
    )
    const reasonWidth = Math.max(
      6,
      ...summarizedEvents.map((event) => event.reason.length)
    )
    const ageWidth = Math.max(
      4,
      ...summarizedEvents.map((event) => event.age.length)
    )
    const sourceWidth = Math.max(
      4,
      ...summarizedEvents.map((event) => event.source.length)
    )

    const rows = summarizedEvents.map((event) => {
      return `  ${event.type.padEnd(typeWidth)}  ${event.reason.padEnd(reasonWidth)}  ${event.age.padEnd(ageWidth)}  ${event.source.padEnd(sourceWidth)}  ${event.message}`
    })

    const header = `  ${'Type'.padEnd(typeWidth)}  ${'Reason'.padEnd(reasonWidth)}  ${'Age'.padEnd(ageWidth)}  ${'From'.padEnd(sourceWidth)}  Message`
    const separator = `  ${'-'.repeat(typeWidth)}  ${'-'.repeat(reasonWidth)}  ${'-'.repeat(ageWidth)}  ${'-'.repeat(sourceWidth)}  -------`

    return ['Events:', header, separator, ...rows].join('\n')
  }

  const lines: string[] = []
  lines.push(`Name:          ${persistentVolumeClaim.metadata.name}`)
  lines.push(`Namespace:     ${persistentVolumeClaim.metadata.namespace}`)
  lines.push(
    `StorageClass:  ${persistentVolumeClaim.spec.storageClassName ?? '<none>'}`
  )
  lines.push(`Status:        ${persistentVolumeClaim.status.phase}`)
  lines.push(`Volume:        ${persistentVolumeClaim.spec.volumeName ?? ''}`)
  lines.push(
    `Labels:        ${formatLabels(persistentVolumeClaim.metadata.labels)}`
  )
  lines.push(
    `Annotations:   ${formatLabels(persistentVolumeClaim.metadata.annotations)}`
  )
  lines.push(`Finalizers:    ${resolveFinalizers()}`)
  lines.push(
    `Capacity:      ${persistentVolumeClaim.status.phase === 'Bound' ? persistentVolumeClaim.spec.resources.requests.storage : ''}`
  )
  lines.push(
    `Access Modes:  ${persistentVolumeClaim.status.phase === 'Bound' ? persistentVolumeClaim.spec.accessModes.join(',') : ''}`
  )
  lines.push(`VolumeMode:    ${resolveVolumeMode()}`)
  lines.push(`Used By:       ${resolveUsedBy()}`)
  lines.push(resolveEvents())
  return lines.join('\n')
}
