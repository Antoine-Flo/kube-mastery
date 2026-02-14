import { describe, expect, it } from 'vitest'
import { createClusterState } from '../../../src/core/cluster/ClusterState'
import { createEventBus } from '../../../src/core/cluster/events/EventBus'
import {
  applySystemBootstrap,
  createSystemBootstrapResources
} from '../../../src/core/cluster/systemBootstrap'

describe('systemBootstrap', () => {
  it('creates expected kind-like bootstrap resources', () => {
    const resources = createSystemBootstrapResources({
      clusterName: 'conformance',
      clock: () => '2026-02-13T12:00:00Z'
    })

    expect(resources.nodes).toHaveLength(3)
    expect(resources.nodes.map((node) => node.metadata.name)).toEqual([
      'conformance-control-plane',
      'conformance-worker',
      'conformance-worker2'
    ])
    expect(resources.configMaps).toHaveLength(1)
    expect(resources.configMaps[0].metadata.name).toBe('kube-root-ca.crt')
    expect(resources.configMaps[0].metadata.namespace).toBe('default')
    expect(resources.pods.length).toBeGreaterThan(0)
  })

  it('applies bootstrap resources without duplicates when called twice', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus)
    const clock = () => '2026-02-13T12:00:00Z'
    const expected = createSystemBootstrapResources({
      clusterName: 'conformance',
      clock
    })

    applySystemBootstrap(clusterState, { clusterName: 'conformance', clock })
    applySystemBootstrap(clusterState, { clusterName: 'conformance', clock })

    expect(clusterState.getNodes()).toHaveLength(expected.nodes.length)
    expect(clusterState.getConfigMaps('default')).toHaveLength(
      expected.configMaps.length
    )
    expect(clusterState.getPods()).toHaveLength(expected.pods.length)
  })

  it('supports topology with extra workers without magic strings', () => {
    const resources = createSystemBootstrapResources({
      clusterName: 'conformance',
      clock: () => '2026-02-13T12:00:00Z',
      nodeRoles: ['control-plane', 'worker', 'worker', 'worker']
    })

    expect(resources.nodes.map((node) => node.metadata.name)).toEqual([
      'conformance-control-plane',
      'conformance-worker',
      'conformance-worker2',
      'conformance-worker3'
    ])
    expect(resources.nodes.map((node) => {
      const addresses = node.status.addresses ?? []
      const internal = addresses.find((address) => {
        return address.type === 'InternalIP'
      })
      return internal?.address
    })).toEqual(['172.18.0.2', '172.18.0.3', '172.18.0.4', '172.18.0.5'])
  })
})
