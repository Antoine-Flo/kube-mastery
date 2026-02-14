import { describe, expect, it } from 'vitest'
import {
  buildNodeRoleSlotNames,
  parseClusterNodeRolesFromKindConfig
} from '../../../src/core/cluster/clusterConfig'

describe('clusterConfig', () => {
  it('parse les roles depuis un kind config', () => {
    const yaml = `kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
  - role: worker
  - role: worker
`

    const roles = parseClusterNodeRolesFromKindConfig(yaml)

    expect(roles).toEqual(['control-plane', 'worker', 'worker'])
  })

  it('genere des suffixes stables par role', () => {
    const slots = buildNodeRoleSlotNames([
      'control-plane',
      'worker',
      'worker',
      'worker'
    ])

    expect(slots).toEqual(['control-plane', 'worker', 'worker2', 'worker3'])
  })

  it('rejette un role non supporte', () => {
    const yaml = `kind: Cluster
apiVersion: kind.x-k8s.io/v1alpha4
nodes:
  - role: control-plane
  - role: gpu-worker
`

    expect(() => parseClusterNodeRolesFromKindConfig(yaml)).toThrow(
      'Unsupported node role "gpu-worker"'
    )
  })
})

