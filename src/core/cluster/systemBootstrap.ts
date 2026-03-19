import type { ClusterState } from './ClusterState'
import {
  buildNodeRoleSlotNames,
  DEFAULT_CLUSTER_NODE_ROLES,
  type ClusterNodeRole
} from './clusterConfig'
import { CONFIG } from '../../config'
import { getSystemWorkloads } from './systemPods'
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

export const createSimulatorBootstrapConfig = (): ClusterBootstrapConfig => {
  return {
    ...DEFAULT_KIND_LIKE_BOOTSTRAP,
    clusterName: CONFIG.cluster.simulatorClusterName,
    nodeRoles: DEFAULT_CLUSTER_NODE_ROLES
  }
}

export const createConformanceBootstrapConfig = (
  clusterName = CONFIG.cluster.conformanceClusterName,
  nodeRoles: readonly ClusterNodeRole[] = DEFAULT_CLUSTER_NODE_ROLES
): ClusterBootstrapConfig => {
  return {
    ...DEFAULT_KIND_LIKE_BOOTSTRAP,
    clusterName,
    nodeRoles
  }
}

const createReadyCondition = (): NodeCondition => {
  return {
    type: 'Ready',
    status: 'True'
  }
}

const createNodeConditions = (creationTimestamp: string): NodeCondition[] => {
  return [
    {
      type: 'MemoryPressure',
      status: 'False',
      lastHeartbeatTime: creationTimestamp,
      lastTransitionTime: creationTimestamp,
      reason: 'KubeletHasSufficientMemory',
      message: 'kubelet has sufficient memory available'
    },
    {
      type: 'DiskPressure',
      status: 'False',
      lastHeartbeatTime: creationTimestamp,
      lastTransitionTime: creationTimestamp,
      reason: 'KubeletHasNoDiskPressure',
      message: 'kubelet has no disk pressure'
    },
    {
      type: 'PIDPressure',
      status: 'False',
      lastHeartbeatTime: creationTimestamp,
      lastTransitionTime: creationTimestamp,
      reason: 'KubeletHasSufficientPID',
      message: 'kubelet has sufficient PID available'
    },
    {
      ...createReadyCondition(),
      lastHeartbeatTime: creationTimestamp,
      lastTransitionTime: creationTimestamp,
      reason: 'KubeletReady',
      message: 'kubelet is posting ready status'
    }
  ]
}

const createNodeInternalIP = (nodeIndex: number): string => {
  return `172.18.0.${nodeIndex + 2}`
}

const createNodeLabels = (
  role: ClusterNodeRole,
  nodeName: string
): Record<string, string> => {
  const baseLabels: Record<string, string> = {
    'beta.kubernetes.io/arch': 'amd64',
    'beta.kubernetes.io/os': 'linux',
    'kubernetes.io/arch': 'amd64',
    'kubernetes.io/hostname': nodeName,
    'kubernetes.io/os': 'linux'
  }
  if (role === 'control-plane') {
    return {
      ...baseLabels,
      'node-role.kubernetes.io/control-plane': '',
      'node.kubernetes.io/exclude-from-external-load-balancers': ''
    }
  }
  return baseLabels
}

const createNodeAnnotations = (): Record<string, string> => {
  return {
    'node.alpha.kubernetes.io/ttl': '0',
    'volumes.kubernetes.io/controller-managed-attach-detach': 'true'
  }
}

const createNodeCapacity = (): Record<string, string> => {
  return {
    cpu: '24',
    'ephemeral-storage': '951220Mi',
    'hugepages-1Gi': '0',
    'hugepages-2Mi': '0',
    memory: '49157748Ki',
    pods: '110'
  }
}

const createNodePodCIDR = (nodeIndex: number): string => {
  return `10.244.${nodeIndex}.0/24`
}

const stableHex = (seed: string, length: number): string => {
  let hash = 0
  for (let index = 0; index < seed.length; index++) {
    hash = (hash << 5) - hash + seed.charCodeAt(index)
    hash |= 0
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0')
  let output = ''
  while (output.length < length) {
    output = `${output}${hex}`
  }
  return output.slice(0, length)
}

const createMachineID = (clusterName: string, nodeName: string): string => {
  return stableHex(`${clusterName}/${nodeName}/machine-id`, 32)
}

const createSystemUUID = (clusterName: string, nodeName: string): string => {
  const raw = stableHex(`${clusterName}/${nodeName}/system-uuid`, 32)
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-${raw.slice(12, 16)}-${raw.slice(16, 20)}-${raw.slice(20, 32)}`
}

const createBootstrapNode = (
  clusterName: string,
  role: ClusterNodeRole,
  roleSlotName: string,
  nodeIndex: number,
  creationTimestamp: string
): Node => {
  const nodeName = `${clusterName}-${roleSlotName}`
  const spec =
    role === 'control-plane'
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
    labels: createNodeLabels(role, nodeName),
    annotations: createNodeAnnotations(),
    creationTimestamp,
    spec: {
      ...spec,
      podCIDR: createNodePodCIDR(nodeIndex),
      podCIDRs: [createNodePodCIDR(nodeIndex)],
      providerID: `kind://docker/${clusterName}/${nodeName}`
    },
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
      capacity: createNodeCapacity(),
      allocatable: createNodeCapacity(),
      conditions: createNodeConditions(creationTimestamp),
      nodeInfo: {
        architecture: 'amd64',
        bootID: 'bf73921b-7ffd-4fd6-8b89-3e87a95e957c',
        containerRuntimeVersion: 'containerd://2.2.0',
        kernelVersion: '6.18.9-200.fc43.x86_64',
        kubeProxyVersion: '',
        kubeletVersion: 'v1.35.0',
        machineID: createMachineID(clusterName, nodeName),
        operatingSystem: 'linux',
        osImage: 'Debian GNU/Linux 12 (bookworm)',
        systemUUID: createSystemUUID(clusterName, nodeName)
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
      'ca.crt':
        '-----BEGIN CERTIFICATE-----\nSIMULATED-CA\n-----END CERTIFICATE-----'
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

type BootstrapKind =
  | 'Namespace'
  | 'Node'
  | 'ConfigMap'
  | 'Service'
  | 'Deployment'
  | 'DaemonSet'
  | 'Pod'

interface BootstrapResource {
  metadata: {
    name: string
    namespace?: string
  }
}

type BootstrapResult<T> =
  | {
      ok: true
      value: T
    }
  | {
      ok: false
      error: string
    }

interface BootstrapStore {
  findByKind: (
    kind: BootstrapKind,
    name: string,
    namespace?: string
  ) => BootstrapResult<BootstrapResource>
  listByKind: (
    kind: BootstrapKind,
    namespace?: string
  ) => readonly BootstrapResource[]
  createByKind: (
    kind: BootstrapKind,
    resource: BootstrapResource,
    namespace?: string
  ) => BootstrapResult<BootstrapResource>
  updateByKind: (
    kind: BootstrapKind,
    name: string,
    resource: BootstrapResource,
    namespace?: string
  ) => BootstrapResult<BootstrapResource>
  deleteByKind: (
    kind: BootstrapKind,
    name: string,
    namespace?: string
  ) => BootstrapResult<BootstrapResource>
}

export interface BootstrapApiLike {
  findResource: (
    kind: BootstrapKind,
    name: string,
    namespace?: string
  ) => BootstrapResult<BootstrapResource>
  listResources: (
    kind: BootstrapKind,
    namespace?: string
  ) => readonly BootstrapResource[]
  createResource: (
    kind: BootstrapKind,
    resource: BootstrapResource,
    namespace?: string
  ) => BootstrapResult<BootstrapResource>
  updateResource: (
    kind: BootstrapKind,
    name: string,
    resource: BootstrapResource,
    namespace?: string
  ) => BootstrapResult<BootstrapResource>
  deleteResource: (
    kind: BootstrapKind,
    name: string,
    namespace?: string
  ) => BootstrapResult<BootstrapResource>
}

const assertBootstrapWriteResult = <T>(
  result: BootstrapResult<T>,
  operation: string
): void => {
  if (result.ok) {
    return
  }
  throw new Error(`Bootstrap ${operation} failed: ${result.error}`)
}

const createBootstrapStoreFromClusterState = (
  clusterState: ClusterState
): BootstrapStore => {
  const createByKind = (
    kind: BootstrapKind,
    resource: BootstrapResource
  ): BootstrapResult<BootstrapResource> => {
    if (kind === 'Namespace') {
      return clusterState.createByKind('Namespace', resource as Namespace)
    }
    if (kind === 'Node') {
      return clusterState.createByKind('Node', resource as Node)
    }
    if (kind === 'ConfigMap') {
      return clusterState.createByKind(
        'ConfigMap',
        resource as ConfigMap,
      )
    }
    if (kind === 'Service') {
      return clusterState.createByKind('Service', resource as Service)
    }
    if (kind === 'Deployment') {
      return clusterState.createByKind(
        'Deployment',
        resource as Deployment,
      )
    }
    if (kind === 'DaemonSet') {
      return clusterState.createByKind(
        'DaemonSet',
        resource as DaemonSet,
      )
    }
    return clusterState.createByKind('Pod', resource as Pod)
  }

  const updateByKind = (
    kind: BootstrapKind,
    name: string,
    resource: BootstrapResource,
    namespace?: string
  ): BootstrapResult<BootstrapResource> => {
    if (kind === 'Namespace') {
      return clusterState.updateByKind('Namespace', name, resource as Namespace)
    }
    if (kind === 'Node') {
      return clusterState.updateByKind('Node', name, resource as Node)
    }
    if (kind === 'ConfigMap') {
      return clusterState.updateByKind(
        'ConfigMap',
        name,
        resource as ConfigMap,
        namespace
      )
    }
    if (kind === 'Service') {
      return clusterState.updateByKind(
        'Service',
        name,
        resource as Service,
        namespace
      )
    }
    if (kind === 'Deployment') {
      return clusterState.updateByKind(
        'Deployment',
        name,
        resource as Deployment,
        namespace
      )
    }
    if (kind === 'DaemonSet') {
      return clusterState.updateByKind(
        'DaemonSet',
        name,
        resource as DaemonSet,
        namespace
      )
    }
    return clusterState.updateByKind('Pod', name, resource as Pod, namespace)
  }

  const deleteByKind = (
    kind: BootstrapKind,
    name: string,
    namespace?: string
  ): BootstrapResult<BootstrapResource> => {
    if (kind === 'Namespace') {
      return clusterState.deleteByKind('Namespace', name)
    }
    if (kind === 'Node') {
      return clusterState.deleteByKind('Node', name)
    }
    if (kind === 'ConfigMap') {
      return clusterState.deleteByKind('ConfigMap', name, namespace)
    }
    if (kind === 'Service') {
      return clusterState.deleteByKind('Service', name, namespace)
    }
    if (kind === 'Deployment') {
      return clusterState.deleteByKind('Deployment', name, namespace)
    }
    if (kind === 'DaemonSet') {
      return clusterState.deleteByKind('DaemonSet', name, namespace)
    }
    return clusterState.deleteByKind('Pod', name, namespace)
  }

  return {
    findByKind: (kind, name, namespace) => {
      return clusterState.findByKind(kind, name, namespace) as BootstrapResult<
        BootstrapResource
      >
    },
    listByKind: (kind, namespace) => {
      return clusterState.listByKind(kind, namespace) as readonly BootstrapResource[]
    },
    createByKind: (kind, resource) => {
      return createByKind(kind, resource)
    },
    updateByKind: (kind, name, resource, namespace) => {
      return updateByKind(kind, name, resource, namespace)
    },
    deleteByKind: (kind, name, namespace) => {
      return deleteByKind(kind, name, namespace)
    }
  }
}

const createBootstrapStoreFromApi = (api: BootstrapApiLike): BootstrapStore => {
  return {
    findByKind: (kind, name, namespace) => {
      return api.findResource(kind, name, namespace) as BootstrapResult<
        BootstrapResource
      >
    },
    listByKind: (kind, namespace) => {
      return api.listResources(kind, namespace) as readonly BootstrapResource[]
    },
    createByKind: (kind, resource, namespace) => {
      return api.createResource(
        kind,
        resource,
        namespace
      ) as BootstrapResult<BootstrapResource>
    },
    updateByKind: (kind, name, resource, namespace) => {
      return api.updateResource(
        kind,
        name,
        resource,
        namespace
      ) as BootstrapResult<BootstrapResource>
    },
    deleteByKind: (kind, name, namespace) => {
      return api.deleteResource(kind, name, namespace) as BootstrapResult<
        BootstrapResource
      >
    }
  }
}

const upsertResourcesByKind = <T extends BootstrapResource>(
  store: BootstrapStore,
  kind: BootstrapKind,
  resources: readonly T[]
): void => {
  for (const resource of resources) {
    const resourceNamespace = resource.metadata.namespace
    const findResult =
      resourceNamespace == null
        ? store.findByKind(kind, resource.metadata.name)
        : store.findByKind(kind, resource.metadata.name, resourceNamespace)
    if (!findResult.ok) {
      if (resourceNamespace == null) {
        assertBootstrapWriteResult(
          store.createByKind(kind, resource),
          `create ${kind}/${resource.metadata.name}`
        )
      } else {
        assertBootstrapWriteResult(
          store.createByKind(kind, resource, resourceNamespace),
          `create ${kind}/${resourceNamespace}/${resource.metadata.name}`
        )
      }
      continue
    }
    if (resourceNamespace == null) {
      assertBootstrapWriteResult(
        store.updateByKind(kind, resource.metadata.name, resource),
        `update ${kind}/${resource.metadata.name}`
      )
    } else {
      assertBootstrapWriteResult(
        store.updateByKind(
          kind,
          resource.metadata.name,
          resource,
          resourceNamespace
        ),
        `update ${kind}/${resourceNamespace}/${resource.metadata.name}`
      )
    }
  }
}

const removeExistingSystemPods = (store: BootstrapStore): void => {
  const pods = store.listByKind('Pod') as readonly Pod[]
  for (const pod of pods) {
    if (!isSystemPodNamespace(pod.metadata.namespace)) {
      continue
    }
    assertBootstrapWriteResult(
      store.deleteByKind('Pod', pod.metadata.name, pod.metadata.namespace),
      `delete Pod/${pod.metadata.namespace}/${pod.metadata.name}`
    )
  }
}

const upsertNodes = (store: BootstrapStore, nodes: Node[]): void => {
  upsertResourcesByKind(store, 'Node', nodes)
}

const upsertNamespaces = (
  store: BootstrapStore,
  namespaces: Namespace[]
): void => {
  upsertResourcesByKind(store, 'Namespace', namespaces)
}

const upsertConfigMaps = (
  store: BootstrapStore,
  configMaps: ConfigMap[]
): void => {
  upsertResourcesByKind(store, 'ConfigMap', configMaps)
}

const upsertServices = (
  store: BootstrapStore,
  services: Service[]
): void => {
  upsertResourcesByKind(store, 'Service', services)
}

const upsertDeployments = (
  store: BootstrapStore,
  deployments: Deployment[]
): void => {
  upsertResourcesByKind(store, 'Deployment', deployments)
}

const upsertDaemonSets = (
  store: BootstrapStore,
  daemonSets: DaemonSet[]
): void => {
  upsertResourcesByKind(store, 'DaemonSet', daemonSets)
}

const addMissingPods = (store: BootstrapStore, pods: readonly Pod[]): void => {
  for (const pod of pods) {
    const findPodResult = store.findByKind(
      'Pod',
      pod.metadata.name,
      pod.metadata.namespace
    )
    if (!findPodResult.ok) {
      assertBootstrapWriteResult(
        store.createByKind('Pod', pod, pod.metadata.namespace),
        `create Pod/${pod.metadata.namespace}/${pod.metadata.name}`
      )
    }
  }
}

const ensureSystemPods = (store: BootstrapStore, pods: Pod[]): void => {
  addMissingPods(store, pods)
}

const replaceSystemPods = (store: BootstrapStore, pods: Pod[]): void => {
  removeExistingSystemPods(store)
  addMissingPods(store, pods)
}

const applyKindLikeBootstrap = (
  store: BootstrapStore,
  options: ClusterBootstrapConfig
): void => {
  const resources = createSystemBootstrapResources(options)
  const mode = options.mode ?? 'missing-only'

  upsertNamespaces(store, resources.namespaces)
  upsertNodes(store, resources.nodes)
  upsertConfigMaps(store, resources.configMaps)
  upsertServices(store, resources.services)
  upsertDeployments(store, resources.deployments)
  upsertDaemonSets(store, resources.daemonSets)

  if (mode === 'always') {
    replaceSystemPods(store, resources.staticPods)
    return
  }

  ensureSystemPods(store, resources.staticPods)
}

export const applyClusterBootstrap = (
  clusterState: ClusterState,
  config: ClusterBootstrapConfig
): void => {
  const store = createBootstrapStoreFromClusterState(clusterState)
  const mode = config.mode ?? 'missing-only'
  if (mode === 'never') {
    return
  }

  const profile = config.profile ?? 'kind-like'
  if (profile === 'none') {
    return
  }

  if (profile === 'kind-like') {
    applyKindLikeBootstrap(store, config)
  }
}

export const applyClusterBootstrapViaApi = (
  api: BootstrapApiLike,
  config: ClusterBootstrapConfig
): void => {
  const store = createBootstrapStoreFromApi(api)
  const mode = config.mode ?? 'missing-only'
  if (mode === 'never') {
    return
  }

  const profile = config.profile ?? 'kind-like'
  if (profile === 'none') {
    return
  }

  if (profile === 'kind-like') {
    applyKindLikeBootstrap(store, config)
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
