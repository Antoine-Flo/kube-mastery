import { describe, expect, it } from 'vitest'
import { createClusterState } from '../../../src/core/cluster/ClusterState'
import { SIMULATOR_CLUSTER_NAME } from '../../../src/config/runtimeConfig'
import { createEventBus } from '../../../src/core/cluster/events/EventBus'
import { DEFAULT_KIND_LIKE_BOOTSTRAP } from '../../../src/core/cluster/systemBootstrap'

describe('createClusterState bootstrap policy', () => {
  it('does not bootstrap when no bootstrap option is provided', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus)

    expect(clusterState.getNodes()).toHaveLength(0)
    expect(clusterState.getConfigMaps('default')).toHaveLength(0)
  })

  it('bootstraps with kind-like profile when bootstrap option is provided', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus, {
      bootstrap: {
        ...DEFAULT_KIND_LIKE_BOOTSTRAP,
        clusterName: SIMULATOR_CLUSTER_NAME
      }
    })

    expect(clusterState.getNodes().map((node) => node.metadata.name)).toEqual([
      `${SIMULATOR_CLUSTER_NAME}-control-plane`,
      `${SIMULATOR_CLUSTER_NAME}-worker`,
      `${SIMULATOR_CLUSTER_NAME}-worker2`
    ])
    expect(clusterState.getConfigMaps('default').some((configMap) => {
      return configMap.metadata.name === 'kube-root-ca.crt'
    })).toBe(true)
  })

  it('supports explicit none profile to disable bootstrap', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus, {
      bootstrap: {
        profile: 'none',
        mode: 'missing-only'
      }
    })

    expect(clusterState.getNodes()).toHaveLength(0)
    expect(clusterState.getConfigMaps('default')).toHaveLength(0)
  })
})
