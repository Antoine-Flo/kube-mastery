import {
  buildNodeRoleSlotNames,
  type ClusterNodeRole
} from '../clusterConfig'
import type { PodToleration } from '../ressources/Pod'

export type SimSystemWorkloadPolicy = 'conformance'

export interface SimSystemWorkloadNode {
  role: ClusterNodeRole
  name: string
}

export interface SimStaticPodWorkloadSpec {
  kind: 'static'
  name: string
  namespace: string
  containerName: string
  nodeName: string
}

export interface SimDaemonSetWorkloadSpec {
  kind: 'daemonset'
  namespace: string
  podPrefix: string
  containerName: string
  nodeNames: string[]
  tolerations?: PodToleration[]
}

export interface SimDeploymentWorkloadSpec {
  kind: 'deployment'
  namespace: string
  podPrefix: string
  containerName: string
  replicas: number
  nodeSelector?: Record<string, string>
  tolerations?: PodToleration[]
  annotations?: Record<string, string>
}

export type SimSystemWorkloadSpec =
  | SimStaticPodWorkloadSpec
  | SimDaemonSetWorkloadSpec
  | SimDeploymentWorkloadSpec

export interface SimSystemWorkloadSpecsOptions {
  clusterName: string
  nodeRoles: readonly ClusterNodeRole[]
  policy?: SimSystemWorkloadPolicy
}

const buildNodes = (
  clusterName: string,
  nodeRoles: readonly ClusterNodeRole[]
): SimSystemWorkloadNode[] => {
  const roleSlots = buildNodeRoleSlotNames(nodeRoles)
  return roleSlots.map((slotName, index) => {
    return {
      role: nodeRoles[index],
      name: `${clusterName}-${slotName}`
    }
  })
}

const getControlPlaneNodeName = (nodes: SimSystemWorkloadNode[]): string => {
  const controlPlaneNode = nodes.find((node) => {
    return node.role === 'control-plane'
  })
  if (controlPlaneNode != null) {
    return controlPlaneNode.name
  }
  return nodes[0]?.name ?? 'control-plane'
}

const createStaticSpecs = (controlPlaneNodeName: string): SimSystemWorkloadSpec[] => {
  return [
    {
      kind: 'static',
      name: 'etcd-control-plane',
      namespace: 'kube-system',
      containerName: 'etcd',
      nodeName: controlPlaneNodeName
    },
    {
      kind: 'static',
      name: 'kube-apiserver-control-plane',
      namespace: 'kube-system',
      containerName: 'kube-apiserver',
      nodeName: controlPlaneNodeName
    },
    {
      kind: 'static',
      name: 'kube-controller-manager-control-plane',
      namespace: 'kube-system',
      containerName: 'kube-controller-manager',
      nodeName: controlPlaneNodeName
    },
    {
      kind: 'static',
      name: 'kube-scheduler-control-plane',
      namespace: 'kube-system',
      containerName: 'kube-scheduler',
      nodeName: controlPlaneNodeName
    }
  ]
}

const createDaemonSetSpecs = (nodeNames: string[]): SimSystemWorkloadSpec[] => {
  const controlPlaneToleration: PodToleration = {
    key: 'node-role.kubernetes.io/control-plane',
    operator: 'Exists',
    effect: 'NoSchedule'
  }
  return [
    {
      kind: 'daemonset',
      namespace: 'kube-system',
      podPrefix: 'kindnet',
      containerName: 'kindnet',
      nodeNames,
      tolerations: [controlPlaneToleration]
    },
    {
      kind: 'daemonset',
      namespace: 'kube-system',
      podPrefix: 'kube-proxy',
      containerName: 'kube-proxy',
      nodeNames,
      tolerations: [controlPlaneToleration]
    }
  ]
}

const createDeploymentSpecs = (
  controlPlaneNodeName: string,
  policy: SimSystemWorkloadPolicy
): SimSystemWorkloadSpec[] => {
  if (policy === 'conformance') {
    return [
      {
        kind: 'deployment',
        namespace: 'kube-system',
        podPrefix: 'coredns',
        containerName: 'coredns',
        replicas: 2,
        nodeSelector: {
          'node-role.kubernetes.io/control-plane': ''
        },
        tolerations: [
          {
            key: 'node-role.kubernetes.io/control-plane',
            operator: 'Exists',
            effect: 'NoSchedule'
          }
        ],
        annotations: {
          'sim.kubernetes.io/preferred-node': controlPlaneNodeName
        }
      }
    ]
  }
  return []
}

const createStorageSpecs = (
  controlPlaneNodeName: string
): SimSystemWorkloadSpec[] => {
  return [
    {
      kind: 'deployment',
      namespace: 'local-path-storage',
      podPrefix: 'local-path-provisioner',
      containerName: 'local-path-provisioner',
      replicas: 1,
      nodeSelector: {
        'node-role.kubernetes.io/control-plane': ''
      },
      tolerations: [
        {
          key: 'node-role.kubernetes.io/control-plane',
          operator: 'Exists',
          effect: 'NoSchedule'
        }
      ],
      annotations: {
        'sim.kubernetes.io/preferred-node': controlPlaneNodeName
      }
    }
  ]
}

export const createSimSystemWorkloadSpecs = (
  options: SimSystemWorkloadSpecsOptions
): SimSystemWorkloadSpec[] => {
  const policy = options.policy ?? 'conformance'
  const nodes = buildNodes(options.clusterName, options.nodeRoles)
  const nodeNames = nodes.map((node) => node.name)
  const controlPlaneNodeName = getControlPlaneNodeName(nodes)
  return [
    ...createStaticSpecs(controlPlaneNodeName),
    ...createDaemonSetSpecs(nodeNames),
    ...createDeploymentSpecs(controlPlaneNodeName, policy),
    ...createStorageSpecs(controlPlaneNodeName)
  ]
}
