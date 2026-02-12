// ═══════════════════════════════════════════════════════════════════════════
// INTRO SEED
// ═══════════════════════════════════════════════════════════════════════════
// Seed for the intro demo: 1 control-plane + 2 workers, no pods.
// Used when task group has environment "intro".

import { createClusterStateData } from '../../core/cluster/ClusterState'
import { createNode } from '../../core/cluster/ressources/Node'
import type { FsConfig } from '../../core/filesystem/debianFileSystem'

const nodeInfo = {
  architecture: 'amd64',
  containerRuntimeVersion: 'containerd://1.6',
  kernelVersion: '5.15.0',
  kubeletVersion: 'v1.28.0',
  operatingSystem: 'linux',
  osImage: 'Debian GNU/Linux 12'
}

export const clusterStateData = createClusterStateData({
  nodes: [
    createNode({
      name: 'control-plane',
      labels: { 'node-role.kubernetes.io/control-plane': '' },
      status: {
        addresses: [
          { type: 'InternalIP', address: '10.0.0.1' },
          { type: 'Hostname', address: 'control-plane' }
        ],
        conditions: [
          { type: 'Ready', status: 'True' },
          { type: 'MemoryPressure', status: 'False' },
          { type: 'DiskPressure', status: 'False' }
        ],
        nodeInfo: { ...nodeInfo }
      }
    }),
    createNode({
      name: 'worker-1',
      labels: { 'node-role.kubernetes.io/worker': '' },
      status: {
        addresses: [
          { type: 'InternalIP', address: '10.0.0.2' },
          { type: 'Hostname', address: 'worker-1' }
        ],
        conditions: [
          { type: 'Ready', status: 'True' },
          { type: 'MemoryPressure', status: 'False' },
          { type: 'DiskPressure', status: 'False' }
        ],
        nodeInfo: { ...nodeInfo }
      }
    }),
    createNode({
      name: 'worker-2',
      labels: { 'node-role.kubernetes.io/worker': '' },
      status: {
        addresses: [
          { type: 'InternalIP', address: '10.0.0.3' },
          { type: 'Hostname', address: 'worker-2' }
        ],
        conditions: [
          { type: 'Ready', status: 'True' },
          { type: 'MemoryPressure', status: 'False' },
          { type: 'DiskPressure', status: 'False' }
        ],
        nodeInfo: { ...nodeInfo }
      }
    })
  ]
})

export const fsConfig: FsConfig = {}
