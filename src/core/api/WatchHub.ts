import type { ClusterEvent } from '../cluster/events/types'
import type { EventBus } from '../cluster/events/EventBus'
import type { AppEvent } from '../events/AppEvent'
import type { EventSubscriber, UnsubscribeFn } from '../events/types'

const isClusterEvent = (event: AppEvent): event is ClusterEvent => {
  const clusterPrefixPattern =
    /^(Pod|ConfigMap|Secret|ReplicaSet|Deployment|DaemonSet|PersistentVolumeClaim|PersistentVolume|Service)/
  return clusterPrefixPattern.test(event.type)
}

export interface WatchHub {
  watchAllClusterEvents: (
    subscriber: EventSubscriber<ClusterEvent>
  ) => UnsubscribeFn
  watchClusterEventType: (
    eventType: ClusterEvent['type'],
    subscriber: EventSubscriber<ClusterEvent>
  ) => UnsubscribeFn
}

export const createWatchHub = (eventBus: EventBus): WatchHub => {
  return {
    watchAllClusterEvents: (
      subscriber: EventSubscriber<ClusterEvent>
    ): UnsubscribeFn => {
      return eventBus.subscribeAll((event: AppEvent) => {
        if (isClusterEvent(event)) {
          subscriber(event)
        }
      })
    },
    watchClusterEventType: (
      eventType: ClusterEvent['type'],
      subscriber: EventSubscriber<ClusterEvent>
    ): UnsubscribeFn => {
      return eventBus.subscribe(eventType, (event) => {
        subscriber(event as ClusterEvent)
      })
    }
  }
}
