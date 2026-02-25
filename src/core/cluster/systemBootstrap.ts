import type { ClusterState } from './ClusterState'
import {
  buildNodeRoleSlotNames,
  DEFAULT_CLUSTER_NODE_ROLES,
  type ClusterNodeRole
} from './clusterConfig'
import { getSystemWorkloads } from './systemPods'
import type { SimSystemWorkloadPolicy } from './systemWorkloads/SimWorkloadSpecs'
import type { ConfigMap } from './ressources/ConfigMap'
import { createConfigMap } from './ressources/ConfigMap'
import type { DaemonSet } from './ressources/DaemonSet'
import type { Node, NodeCondition } from './ressources/Node'
import { createNode } from './ressources/Node'
import type { Namespace } from './ressources/Namespace'
import type { Deployment } from './ressources/Deployment'
import type { Pod } from './ressources/Pod'
import type { Service } from './ressources/Service'
import { createService } from './ressources/Service'
import { createSystemNamespaces, isSystemNamespace } from './systemNamespaces'

export interface SystemBootstrapOptions {
  clusterName?: string
  clock?: () => string
  nodeRoles?: readonly ClusterNodeRole[]
  systemWorkloadPolicy?: SimSystemWorkloadPolicy
}

export type ClusterBootstrapProfile = 'kind-like' | 'none'

export type ClusterBootstrapMode = 'always' | 'missing-only' | 'never'

export interface ClusterBootstrapConfig extends SystemBootstrapOptions {
  profile?: ClusterBootstrapProfile
  mode?: ClusterBootstrapMode
}

export interface SystemBootstrapResources {
  namespaces: Namespace[]
  nodes: Node[]
  configMaps: ConfigMap[]
  services: Service[]
  pods: Pod[]
  staticPods: Pod[]
  deployments: Deployment[]
  daemonSets: DaemonSet[]
}

const DEFAULT_CLUSTER_NAME = 'conformance'

export const DEFAULT_KIND_LIKE_BOOTSTRAP: Readonly<
  Pick<ClusterBootstrapConfig, 'profile' | 'mode'>
> = Object.freeze({
  profile: 'kind-like',
  mode: 'missing-only'
})

const createReadyCondition = (): NodeCondition => {
  return {
    type: 'Ready',
    status: 'True'
  }
}

const createNodeInternalIP = (nodeIndex: number): string => {
  return `172.18.0.${nodeIndex + 2}`
}

const createNodeLabels = (
  role: ClusterNodeRole
): Record<string, string> => {
  if (role === 'control-plane') {
    return {
      'node-role.kubernetes.io/control-plane': '',
      'kubernetes.io/os': 'linux',
      'kubernetes.io/arch': 'amd64'
    }
  }
  return {
    'kubernetes.io/os': 'linux',
    'kubernetes.io/arch': 'amd64'
  }
}

const createBootstrapNode = (
  clusterName: string,
  role: ClusterNodeRole,
  roleSlotName: string,
  nodeIndex: number,
  creationTimestamp: string
): Node => {
  const nodeName = `${clusterName}-${roleSlotName}`
  const spec = role === 'control-plane'
    ? {
        taints: [
          {
            key: 'node-role.kubernetes.io/control-plane',
            effect: 'NoSchedule' as const
          }
        ]
      }
    : {}

  return createNode({
    name: nodeName,
    labels: createNodeLabels(role),
    creationTimestamp,
    spec,
    status: {
      addresses: [
        {
          type: 'InternalIP',
          address: createNodeInternalIP(nodeIndex)
        },
        {
          type: 'Hostname',
          address: nodeName
        }
      ],
      conditions: [createReadyCondition()],
      nodeInfo: {
        architecture: 'amd64',
        containerRuntimeVersion: 'containerd://2.2.0',
        kernelVersion: '6.6.87.2-microsoft-standard-WSL2',
        kubeletVersion: 'v1.35.0',
        operatingSystem: 'linux',
        osImage: 'Debian GNU/Linux 12 (bookworm)'
      }
    }
  })
}

const createKubeRootCAConfigMap = (creationTimestamp: string): ConfigMap => {
  return createConfigMap({
    name: 'kube-root-ca.crt',
    namespace: 'default',
    creationTimestamp,
    data: {
      'ca.crt': '-----BEGIN CERTIFICATE-----\nSIMULATED-CA\n-----END CERTIFICATE-----'
    }
  })
}

const buildKubeconfigIdentity = (clusterName: string): string => {
  const normalizedName = clusterName.trim().toLowerCase()
  if (normalizedName.length === 0) {
    return 'kind-sim'
  }
  return `kind-${normalizedName}`
}

const createClusterInfoKubeconfig = (clusterName: string): string => {
  const kubeconfigIdentity = buildKubeconfigIdentity(clusterName)
  return [
    'apiVersion: v1',
    'kind: Config',
    'clusters:',
    '- cluster:',
    '    certificate-authority-data: DATA+OMITTED',
    '    server: https://127.0.0.1:34001',
    `  name: ${kubeconfigIdentity}`,
    'contexts:',
    '- context:',
    `    cluster: ${kubeconfigIdentity}`,
    `    user: ${kubeconfigIdentity}`,
    `  name: ${kubeconfigIdentity}`,
    `current-context: ${kubeconfigIdentity}`,
    'users:',
    `- name: ${kubeconfigIdentity}`,
    '  user:',
    '    client-certificate-data: DATA+OMITTED',
    '    client-key-data: DATA+OMITTED'
  ].join('\n')
}

const createClusterInfoConfigMap = (
  creationTimestamp: string,
  clusterName: string
): ConfigMap => {
  return createConfigMap({
    name: 'cluster-info',
    namespace: 'kube-public',
    creationTimestamp,
    data: {
      kubeconfig: createClusterInfoKubeconfig(clusterName)
    }
  })
}

const createSystemServices = (creationTimestamp: string): Service[] => {
  return [
    createService({
      name: 'kubernetes',
      namespace: 'default',
      creationTimestamp,
      clusterIP: '10.96.0.1',
      ports: [{ port: 443, protocol: 'TCP' }]
    }),
    createService({
      name: 'kube-dns',
      namespace: 'kube-system',
      creationTimestamp,
      clusterIP: '10.96.0.10',
      ports: [
        { name: 'dns', port: 53, protocol: 'UDP', targetPort: 53 },
        { name: 'dns-tcp', port: 53, protocol: 'TCP', targetPort: 53 },
        { name: 'metrics', port: 9153, protocol: 'TCP', targetPort: 9153 }
      ]
    })
  ]
}

export const createSystemBootstrapResources = (
  options: SystemBootstrapOptions = {}
): SystemBootstrapResources => {
  const clusterName = options.clusterName ?? DEFAULT_CLUSTER_NAME
  const nodeRoles = options.nodeRoles ?? DEFAULT_CLUSTER_NODE_ROLES
  const roleSlotNames = buildNodeRoleSlotNames(nodeRoles)
  const creationTimestamp =
    options.clock != null ? options.clock() : new Date().toISOString()
  const workloads = getSystemWorkloads({
    clusterName,
    nodeRoles,
    policy: options.systemWorkloadPolicy,
    clock: () => creationTimestamp
  })

  return {
    namespaces: createSystemNamespaces(creationTimestamp),
    nodes: nodeRoles.map((role, index) => {
      return createBootstrapNode(
        clusterName,
        role,
        roleSlotNames[index],
        index,
        creationTimestamp
      )
    }),
    configMaps: [
      createKubeRootCAConfigMap(creationTimestamp),
      createClusterInfoConfigMap(creationTimestamp, clusterName)
    ],
    services: createSystemServices(creationTimestamp),
    pods: workloads.staticPods,
    staticPods: workloads.staticPods,
    deployments: workloads.deployments,
    daemonSets: workloads.daemonSets
  }
}

const isSystemPodNamespace = (namespace: string): boolean => {
  return isSystemNamespace(namespace)
}

const upsertNamespaces = (
  clusterState: ClusterState,
  namespaces: Namespace[]
): void => {
  for (const namespace of namespaces) {
    const findNamespaceResult = clusterState.findNamespace(namespace.metadata.name)
    if (!findNamespaceResult.ok) {
      clusterState.addNamespace(namespace)
      continue
    }
    clusterState.updateNamespace(namespace.metadata.name, () => namespace)
  }
}

const removeExistingSystemPods = (clusterState: ClusterState): void => {
  const pods = clusterState.getPods()
  for (const pod of pods) {
    if (!isSystemPodNamespace(pod.metadata.namespace)) {
      continue
    }
    const deleteResult = clusterState.deletePod(
      pod.metadata.name,
      pod.metadata.namespace
    )
    if (!deleteResult.ok) {
      continue
    }
  }
}

const upsertNodes = (clusterState: ClusterState, nodes: Node[]): void => {
  for (const node of nodes) {
    const findNodeResult = clusterState.findNode(node.metadata.name)
    if (!findNodeResult.ok) {
      clusterState.addNode(node)
      continue
    }
    clusterState.updateNode(node.metadata.name, () => node)
  }
}

const upsertConfigMaps = (
  clusterState: ClusterState,
  configMaps: ConfigMap[]
): void => {
  for (const configMap of configMaps) {
    const findConfigMapResult = clusterState.findConfigMap(
      configMap.metadata.name,
      configMap.metadata.namespace
    )
    if (!findConfigMapResult.ok) {
      clusterState.addConfigMap(configMap)
      continue
    }
    clusterState.updateConfigMap(
      configMap.metadata.name,
      configMap.metadata.namespace,
      () => configMap
    )
  }
}

const upsertServices = (clusterState: ClusterState, services: Service[]): void => {
  for (const service of services) {
    const findServiceResult = clusterState.findService(
      service.metadata.name,
      service.metadata.namespace
    )
    if (!findServiceResult.ok) {
      clusterState.addService(service)
      continue
    }
    clusterState.updateService(
      service.metadata.name,
      service.metadata.namespace,
      () => service
    )
  }
}

const upsertDeployments = (
  clusterState: ClusterState,
  deployments: Deployment[]
): void => {
  for (const deployment of deployments) {
    const findDeploymentResult = clusterState.findDeployment(
      deployment.metadata.name,
      deployment.metadata.namespace
    )
    if (!findDeploymentResult.ok) {
      clusterState.addDeployment(deployment)
      continue
    }
    clusterState.updateDeployment(
      deployment.metadata.name,
      deployment.metadata.namespace,
      () => deployment
    )
  }
}

const upsertDaemonSets = (
  clusterState: ClusterState,
  daemonSets: DaemonSet[]
): void => {
  for (const daemonSet of daemonSets) {
    const findDaemonSetResult = clusterState.findDaemonSet(
      daemonSet.metadata.name,
      daemonSet.metadata.namespace
    )
    if (!findDaemonSetResult.ok) {
      clusterState.addDaemonSet(daemonSet)
      continue
    }
    clusterState.updateDaemonSet(
      daemonSet.metadata.name,
      daemonSet.metadata.namespace,
      () => daemonSet
    )
  }
}

const ensureSystemPods = (clusterState: ClusterState, pods: Pod[]): void => {
  for (const pod of pods) {
    const findPodResult = clusterState.findPod(
      pod.metadata.name,
      pod.metadata.namespace
    )
    if (!findPodResult.ok) {
      clusterState.addPod(pod)
    }
  }
}

const replaceSystemPods = (clusterState: ClusterState, pods: Pod[]): void => {
  removeExistingSystemPods(clusterState)
  for (const pod of pods) {
    const findPodResult = clusterState.findPod(
      pod.metadata.name,
      pod.metadata.namespace
    )
    if (!findPodResult.ok) {
      clusterState.addPod(pod)
    }
  }
}

const applyKindLikeBootstrap = (
  clusterState: ClusterState,
  options: ClusterBootstrapConfig
): void => {
  const resources = createSystemBootstrapResources(options)
  const mode = options.mode ?? 'missing-only'

  upsertNamespaces(clusterState, resources.namespaces)
  upsertNodes(clusterState, resources.nodes)
  upsertConfigMaps(clusterState, resources.configMaps)
  upsertServices(clusterState, resources.services)
  upsertDeployments(clusterState, resources.deployments)
  upsertDaemonSets(clusterState, resources.daemonSets)

  if (mode === 'always') {
    replaceSystemPods(clusterState, resources.staticPods)
    return
  }

  ensureSystemPods(clusterState, resources.staticPods)
}

export const applyClusterBootstrap = (
  clusterState: ClusterState,
  config: ClusterBootstrapConfig
): void => {
  const mode = config.mode ?? 'missing-only'
  if (mode === 'never') {
    return
  }

  const profile = config.profile ?? 'kind-like'
  if (profile === 'none') {
    return
  }

  if (profile === 'kind-like') {
    applyKindLikeBootstrap(clusterState, config)
  }
}

export const applySystemBootstrap = (
  clusterState: ClusterState,
  options: SystemBootstrapOptions = {}
): void => {
  applyClusterBootstrap(clusterState, {
    ...DEFAULT_KIND_LIKE_BOOTSTRAP,
    ...options
  })
}
