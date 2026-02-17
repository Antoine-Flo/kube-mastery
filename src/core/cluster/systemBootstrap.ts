import type { ClusterState } from './ClusterState'
import {
  buildNodeRoleSlotNames,
  DEFAULT_CLUSTER_NODE_ROLES,
  type ClusterNodeRole
} from './clusterConfig'
import { getSystemPods } from './systemPods'
import type { SimSystemWorkloadPolicy } from './systemWorkloads/SimWorkloadSpecs'
import type { ConfigMap } from './ressources/ConfigMap'
import { createConfigMap } from './ressources/ConfigMap'
import type { Node, NodeCondition } from './ressources/Node'
import { createNode } from './ressources/Node'
import type { Pod } from './ressources/Pod'

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
  nodes: Node[]
  configMaps: ConfigMap[]
  pods: Pod[]
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
  return createNode({
    name: nodeName,
    labels: createNodeLabels(role),
    creationTimestamp,
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

export const createSystemBootstrapResources = (
  options: SystemBootstrapOptions = {}
): SystemBootstrapResources => {
  const clusterName = options.clusterName ?? DEFAULT_CLUSTER_NAME
  const nodeRoles = options.nodeRoles ?? DEFAULT_CLUSTER_NODE_ROLES
  const roleSlotNames = buildNodeRoleSlotNames(nodeRoles)
  const creationTimestamp =
    options.clock != null ? options.clock() : new Date().toISOString()
  return {
    nodes: nodeRoles.map((role, index) => {
      return createBootstrapNode(
        clusterName,
        role,
        roleSlotNames[index],
        index,
        creationTimestamp
      )
    }),
    configMaps: [createKubeRootCAConfigMap(creationTimestamp)],
    pods: getSystemPods({
      clusterName,
      nodeRoles,
      policy: options.systemWorkloadPolicy,
      clock: () => creationTimestamp
    })
  }
}

const isSystemPodNamespace = (namespace: string): boolean => {
  return namespace === 'kube-system' || namespace === 'local-path-storage'
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

const ensureSystemPods = (clusterState: ClusterState, pods: Pod[]): void => {
  const existingPods = clusterState.getPods()
  const hasExistingSystemPods = existingPods.some((pod) => {
    return isSystemPodNamespace(pod.metadata.namespace)
  })
  if (hasExistingSystemPods) {
    return
  }

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

  upsertNodes(clusterState, resources.nodes)
  upsertConfigMaps(clusterState, resources.configMaps)

  if (mode === 'always') {
    replaceSystemPods(clusterState, resources.pods)
    return
  }

  ensureSystemPods(clusterState, resources.pods)
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
