import { describe, expect, it } from 'vitest'
import { CONFIG } from '../../../src/config'
import { createClusterState } from '../../../src/core/cluster/ClusterState'
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
        clusterName: CONFIG.cluster.simulatorClusterName
      }
    })

    expect(clusterState.getNodes().map((node) => node.metadata.name)).toEqual([
      `${CONFIG.cluster.simulatorClusterName}-control-plane`,
      `${CONFIG.cluster.simulatorClusterName}-worker`,
      `${CONFIG.cluster.simulatorClusterName}-worker2`
    ])
    expect(
      clusterState.getConfigMaps('default').some((configMap) => {
        return configMap.metadata.name === 'kube-root-ca.crt'
      })
    ).toBe(true)
    expect(
      clusterState.getConfigMaps('kube-public').some((configMap) => {
        return configMap.metadata.name === 'cluster-info'
      })
    ).toBe(true)
    const clusterInfoConfigMap = clusterState
      .getConfigMaps('kube-public')
      .find((configMap) => {
        return configMap.metadata.name === 'cluster-info'
      })
    expect(clusterInfoConfigMap?.data?.kubeconfig).toContain(
      `server: ${CONFIG.cluster.kubeconfigServerUrl}`
    )
    expect(
      clusterState.getServices().some((service) => {
        return service.metadata.name === 'kubernetes'
      })
    ).toBe(true)
    expect(
      clusterState.getServices().some((service) => {
        return service.metadata.name === 'kube-dns'
      })
    ).toBe(true)
    expect(
      clusterState.getNamespaces().map((namespace) => namespace.metadata.name)
    ).toContain('local-path-storage')
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
