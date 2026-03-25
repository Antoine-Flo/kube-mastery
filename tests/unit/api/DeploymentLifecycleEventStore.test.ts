import { describe, expect, it } from 'vitest'
import { createEventBus } from '../../../src/core/cluster/events/EventBus'
import { createDeploymentScaledEvent } from '../../../src/core/cluster/events/types'
import { createEtcdLikeStore } from '../../../src/core/etcd/EtcdLikeStore'
import { createDeploymentLifecycleEventStore } from '../../../src/core/api/DeploymentLifecycleEventStore'

describe('DeploymentLifecycleEventStore', () => {
  it('captures scaling events for a deployment', () => {
    const eventBus = createEventBus()
    const etcd = createEtcdLikeStore(eventBus)
    const store = createDeploymentLifecycleEventStore(etcd)

    etcd.appendEvent(
      createDeploymentScaledEvent(
        'default',
        'web-app',
        'web-app-5c8584f7ff',
        0,
        3,
        'deployment-controller'
      )
    )
    etcd.appendEvent(
      createDeploymentScaledEvent(
        'default',
        'web-app',
        'web-app-5c8584f7ff',
        3,
        5,
        'deployment-controller'
      )
    )

    const events = store.listDeploymentEvents('default', 'web-app')
    expect(events).toHaveLength(2)
    expect(events[0]?.reason).toBe('ScalingReplicaSet')
    expect(events[0]?.source).toBe('deployment-controller')
    expect(events[0]?.message).toContain('Scaled up replica set web-app-5c8584f7ff from 0 to 3')
    expect(events[1]?.message).toContain('Scaled up replica set web-app-5c8584f7ff from 3 to 5')
    etcd.dispose()
  })

  it('returns empty list after stop', () => {
    const eventBus = createEventBus()
    const etcd = createEtcdLikeStore(eventBus)
    const store = createDeploymentLifecycleEventStore(etcd)
    store.stop()
    expect(store.listDeploymentEvents('default', 'web-app')).toEqual([])
    etcd.dispose()
  })
})
