import { describe, expect, it } from 'vitest'
import { createClusterState } from '../../../src/core/cluster/ClusterState'
import { createEventBus } from '../../../src/core/cluster/events/EventBus'
import { createConfigMap } from '../../../src/core/cluster/ressources/ConfigMap'
import { createNode } from '../../../src/core/cluster/ressources/Node'
import { createPod } from '../../../src/core/cluster/ressources/Pod'

describe('ClusterState generic lookup API', () => {
  it('findByKind should return a namespaced resource in provided namespace', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus)
    clusterState.addPod(
      createPod({
        name: 'nginx',
        namespace: 'default',
        containers: [{ name: 'nginx', image: 'nginx:latest' }]
      })
    )

    const result = clusterState.findByKind('Pod', 'nginx', 'default')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value.kind).toBe('Pod')
    expect(result.value.metadata.name).toBe('nginx')
  })

  it('findByKind should return NotFound for unknown resource', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus)

    const result = clusterState.findByKind('ConfigMap', 'missing', 'default')

    expect(result.ok).toBe(false)
  })

  it('listByKind should filter namespaced resources by namespace', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus)
    clusterState.addConfigMap(
      createConfigMap({
        name: 'cfg-default',
        namespace: 'default',
        data: { key: 'v1' }
      })
    )
    clusterState.addConfigMap(
      createConfigMap({
        name: 'cfg-system',
        namespace: 'kube-system',
        data: { key: 'v2' }
      })
    )

    const defaultItems = clusterState.listByKind('ConfigMap', 'default')

    expect(defaultItems).toHaveLength(1)
    expect(defaultItems[0].metadata.name).toBe('cfg-default')
  })

  it('listByKind should ignore namespace for cluster-scoped Node', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus)
    clusterState.addNode(
      createNode({
        name: 'node-1',
        status: {
          nodeInfo: {
            architecture: 'amd64',
            containerRuntimeVersion: 'containerd://1.7.0',
            kernelVersion: '6.0.0',
            kubeletVersion: 'v1.35.0',
            operatingSystem: 'linux',
            osImage: 'Ubuntu'
          }
        }
      })
    )

    const allNodes = clusterState.listByKind('Node')
    const namespacedLookupNodes = clusterState.listByKind('Node', 'default')

    expect(allNodes).toHaveLength(1)
    expect(namespacedLookupNodes).toHaveLength(1)
    expect(namespacedLookupNodes[0].metadata.name).toBe('node-1')
  })
})
