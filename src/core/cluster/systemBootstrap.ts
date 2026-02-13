import type { ClusterState } from './ClusterState'
import { getSystemPods } from './systemPods'
import type { ConfigMap } from './ressources/ConfigMap'
import { createConfigMap } from './ressources/ConfigMap'
import type { Node, NodeCondition } from './ressources/Node'
import { createNode } from './ressources/Node'
import type { Pod } from './ressources/Pod'

export interface SystemBootstrapOptions {
  clusterName?: string
  clock?: () => string
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

const createNotReadyCondition = (): NodeCondition => {
  return {
    type: 'Ready',
    status: 'False',
    reason: 'KubeletNotReady',
    message: 'container runtime network not ready'
  }
}

const createNodeInternalIP = (role: 'control-plane' | 'worker' | 'worker2'): string => {
  if (role === 'control-plane') {
    return '172.18.0.2'
  }
  if (role === 'worker') {
    return '172.18.0.3'
  }
  return '172.18.0.4'
}

const createNodeLabels = (
  role: 'control-plane' | 'worker' | 'worker2'
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
  role: 'control-plane' | 'worker' | 'worker2',
  creationTimestamp: string
): Node => {
  const nodeName =
    role === 'control-plane' ? `${clusterName}-control-plane` : `${clusterName}-${role}`
  return createNode({
    name: nodeName,
    labels: createNodeLabels(role),
    creationTimestamp,
    status: {
      addresses: [
        {
          type: 'InternalIP',
          address: createNodeInternalIP(role)
        },
        {
          type: 'Hostname',
          address: nodeName
        }
      ],
      conditions: [createNotReadyCondition()],
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
  const creationTimestamp =
    options.clock != null ? options.clock() : new Date().toISOString()
  return {
    nodes: [
      createBootstrapNode(clusterName, 'control-plane', creationTimestamp),
      createBootstrapNode(clusterName, 'worker', creationTimestamp),
      createBootstrapNode(clusterName, 'worker2', creationTimestamp)
    ],
    configMaps: [createKubeRootCAConfigMap(creationTimestamp)],
    pods: getSystemPods({ clock: () => creationTimestamp })
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
