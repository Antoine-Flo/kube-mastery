// ═══════════════════════════════════════════════════════════════════════════
// DEMO SEED
// ═══════════════════════════════════════════════════════════════════════════
// Static seed for terminal: cluster + optional filesystem.
// Import directly: import { clusterStateData, fsConfig } from '../courses/seeds/demo';

import { createClusterStateData } from '../../core/cluster/ClusterState'
import { createNode } from '../../core/cluster/ressources/Node'
import { createPod } from '../../core/cluster/ressources/Pod'
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
  pods: [
    createPod({
      name: 'nginx',
      namespace: 'default',
      nodeName: 'worker-1',
      containers: [{ name: 'nginx', image: 'nginx:1.25' }],
      phase: 'Running'
    }),
    createPod({
      name: 'redis',
      namespace: 'default',
      nodeName: 'worker-1',
      containers: [{ name: 'redis', image: 'redis:7-alpine' }],
      phase: 'Running'
    }),
    createPod({
      name: 'coredns-6d4b75c6df-2xz9k',
      namespace: 'kube-system',
      nodeName: 'control-plane',
      containers: [{ name: 'coredns', image: 'registry.k8s.io/coredns/coredns:v1.10.1' }],
      phase: 'Running'
    })
  ],
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
    })
  ]
})

export const fsConfig: FsConfig = {
  files: {
    '/home/kube/pod-example.yaml': `apiVersion: v1
kind: Pod
metadata:
  name: nginx-demo
  labels:
    app: nginx
spec:
  containers:
    - name: nginx
      image: nginx:1.25
      ports:
        - containerPort: 80
`
  }
}
