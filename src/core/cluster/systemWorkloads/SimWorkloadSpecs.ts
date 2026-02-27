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
  name: string
  containerName: string
  labels: Record<string, string>
  selectorLabels: Record<string, string>
  nodeSelector?: Record<string, string>
  tolerations?: PodToleration[]
  annotations?: Record<string, string>
}

export interface SimDeploymentWorkloadSpec {
  kind: 'deployment'
  namespace: string
  name: string
  containerName: string
  labels: Record<string, string>
  selectorLabels: Record<string, string>
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

const createControlPlaneStaticPodName = (
  controlPlaneNodeName: string,
  componentName: string
): string => {
  return `${componentName}-${controlPlaneNodeName}`
}

const createStaticSpecs = (
  controlPlaneNodeName: string
): SimSystemWorkloadSpec[] => {
  return [
    {
      kind: 'static',
      name: createControlPlaneStaticPodName(controlPlaneNodeName, 'etcd'),
      namespace: 'kube-system',
      containerName: 'etcd',
      nodeName: controlPlaneNodeName
    },
    {
      kind: 'static',
      name: createControlPlaneStaticPodName(controlPlaneNodeName, 'kube-apiserver'),
      namespace: 'kube-system',
      containerName: 'kube-apiserver',
      nodeName: controlPlaneNodeName
    },
    {
      kind: 'static',
      name: createControlPlaneStaticPodName(
        controlPlaneNodeName,
        'kube-controller-manager'
      ),
      namespace: 'kube-system',
      containerName: 'kube-controller-manager',
      nodeName: controlPlaneNodeName
    },
    {
      kind: 'static',
      name: createControlPlaneStaticPodName(controlPlaneNodeName, 'kube-scheduler'),
      namespace: 'kube-system',
      containerName: 'kube-scheduler',
      nodeName: controlPlaneNodeName
    }
  ]
}

const createDaemonSetSpecs = (): SimSystemWorkloadSpec[] => {
  const controlPlaneToleration: PodToleration = {
    key: 'node-role.kubernetes.io/control-plane',
    operator: 'Exists',
    effect: 'NoSchedule'
  }
  return [
    {
      kind: 'daemonset',
      name: 'kindnet',
      namespace: 'kube-system',
      containerName: 'kindnet',
      labels: { 'k8s-app': 'kindnet' },
      selectorLabels: { 'k8s-app': 'kindnet' },
      nodeSelector: { 'kubernetes.io/os': 'linux' },
      tolerations: [controlPlaneToleration]
    },
    {
      kind: 'daemonset',
      name: 'kube-proxy',
      namespace: 'kube-system',
      containerName: 'kube-proxy',
      labels: { 'k8s-app': 'kube-proxy' },
      selectorLabels: { 'k8s-app': 'kube-proxy' },
      nodeSelector: { 'kubernetes.io/os': 'linux' },
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
        name: 'coredns',
        namespace: 'kube-system',
        containerName: 'coredns',
        labels: { 'k8s-app': 'kube-dns' },
        selectorLabels: { 'k8s-app': 'kube-dns' },
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
      name: 'local-path-provisioner',
      namespace: 'local-path-storage',
      containerName: 'local-path-provisioner',
      labels: { app: 'local-path-provisioner' },
      selectorLabels: { app: 'local-path-provisioner' },
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
  const controlPlaneNodeName = getControlPlaneNodeName(nodes)
  return [
    ...createStaticSpecs(controlPlaneNodeName),
    ...createDaemonSetSpecs(),
    ...createDeploymentSpecs(controlPlaneNodeName, policy),
    ...createStorageSpecs(controlPlaneNodeName)
  ]
}
