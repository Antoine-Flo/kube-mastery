import type { ClusterStateData } from '../../../cluster/ClusterState'
import type { ConfigMap } from '../../../cluster/ressources/ConfigMap'
import type { DaemonSet } from '../../../cluster/ressources/DaemonSet'
import type { Deployment } from '../../../cluster/ressources/Deployment'
import { getDeploymentDesiredReplicas } from '../../../cluster/ressources/Deployment'
import type { Ingress } from '../../../cluster/ressources/Ingress'
import type { Namespace } from '../../../cluster/ressources/Namespace'
import type { Node } from '../../../cluster/ressources/Node'
import type { PersistentVolume } from '../../../cluster/ressources/PersistentVolume'
import type { PersistentVolumeClaim } from '../../../cluster/ressources/PersistentVolumeClaim'
import {
  getNodeExternalIP,
  getNodeInternalIP,
  getNodeRoles,
  getNodeStatus
} from '../../../cluster/ressources/Node'
import type { Pod } from '../../../cluster/ressources/Pod'
import type { ReplicaSet } from '../../../cluster/ressources/ReplicaSet'
import { getReplicaSetDesiredReplicas } from '../../../cluster/ressources/ReplicaSet'
import type { Secret, SecretType } from '../../../cluster/ressources/Secret'
import type { Service } from '../../../cluster/ressources/Service'
import { getServiceType } from '../../../cluster/ressources/Service'
import { formatAge, formatTable } from '../../../shared/formatter'
import type { ParsedCommand, Resource } from '../types'
import {
  renderStructuredPayload,
  resolveOutputDirective,
  validateOutputDirective
} from '../output/outputHelpers'
import { shapeDeploymentForStructuredOutput } from './deploymentOutputShaper'
import { handleGetRaw } from './getRaw'
import { shapePodForStructuredOutput } from './podOutputShaper'

// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL GET HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Each resource defines how to fetch, format, and display its data

interface ResourceWithMetadata {
  metadata: {
    name: string
    namespace: string
    labels?: Record<string, string>
  }
}

/**
 * Resource handler configuration
 * Declarative approach: each resource defines its behavior via config
 */
interface ResourceHandler<T extends ResourceWithMetadata> {
  getItems: (state: ClusterStateData) => T[]
  headers: string[]
  formatRow: (item: T) => string[]
  supportsFiltering: boolean // For future: namespaces don't support filtering
  isClusterScoped?: boolean // True for cluster-scoped resources (nodes, namespaces)
  formatRowWide?: (item: T) => string[] // Optional wide format
  headersWide?: string[] // Optional wide headers
  /** Column alignment for table output (kubectl-style: READY, RESTARTS, AGE right-aligned) */
  align?: ('left' | 'right')[]
}

interface ResourceOutputMetadata {
  apiVersion: string
  kind: string
}

type StructuredResource = Exclude<Resource, 'all'>

interface ResourceListOutput<T> {
  apiVersion: string
  items: T[]
  kind: string
  metadata: {
    resourceVersion: string
  }
}

const KUBECTL_TABLE_SPACING = 3

const withKubectlTableSpacing = (options?: {
  align?: ('left' | 'right')[]
}): { spacing: number; align?: ('left' | 'right')[] } => {
  if (options?.align != null) {
    return {
      spacing: KUBECTL_TABLE_SPACING,
      align: options.align
    }
  }
  return {
    spacing: KUBECTL_TABLE_SPACING
  }
}

const buildLeftAlign = (columnsCount: number): ('left' | 'right')[] => {
  return Array.from({ length: columnsCount }, () => 'left')
}

/**
 * Filter resources by label selector
 * Pure function that matches all labels in selector
 */
const filterByLabels = <T extends ResourceWithMetadata>(
  resources: T[],
  selector: Record<string, string>
): T[] => {
  return resources.filter((resource) => {
    const labels = resource.metadata.labels || {}
    return Object.entries(selector).every(
      ([key, value]) => labels[key] === value
    )
  })
}

/**
 * Filter resources by namespace
 * Pure function for namespace filtering
 */
const filterByNamespace = <T extends ResourceWithMetadata>(
  resources: T[],
  namespace: string
): T[] => {
  return resources.filter(
    (resource) => resource.metadata.namespace === namespace
  )
}

/**
 * Apply all filters to resources
 * Pure function that chains namespace, label, and name filtering.
 * When namespace is undefined (e.g. --all-namespaces), namespaced resources are not filtered by namespace.
 */
const applyFilters = <T extends ResourceWithMetadata>(
  resources: T[],
  namespace: string | undefined,
  selector?: Record<string, string>,
  isClusterScoped: boolean = false,
  name?: string
): T[] => {
  let filtered: T[]
  if (isClusterScoped) {
    filtered = resources
  } else if (namespace === undefined) {
    filtered = resources
  } else {
    filtered = filterByNamespace(resources, namespace)
  }
  if (selector) {
    filtered = filterByLabels(filtered, selector)
  }
  if (name) {
    filtered = filtered.filter((resource) => resource.metadata.name === name)
  }
  return filtered
}

/**
 * Message when no resources match (kubectl behavior: "in X namespace." for namespaced resources)
 */
const noResourcesMessage = (
  effectiveNamespace: string | undefined,
  isClusterScoped: boolean
): string => {
  if (isClusterScoped || effectiveNamespace === undefined) {
    return 'No resources found'
  }
  return `No resources found in ${effectiveNamespace} namespace.`
}

/**
 * Get secret type string from ADT
 * Pure function that extracts type string for display
 */
const getSecretType = (secretType: SecretType): string => {
  return secretType.type
}

/**
 * Get external IP for service display
 * Returns LoadBalancer IP, ExternalIPs, or '<none>'
 */
const getServiceExternalIP = (service: Service): string => {
  if (
    service.status?.loadBalancer?.ingress &&
    service.status.loadBalancer.ingress.length > 0
  ) {
    const ingress = service.status.loadBalancer.ingress[0]
    return ingress.ip || ingress.hostname || '<pending>'
  }
  if (service.spec.externalIPs && service.spec.externalIPs.length > 0) {
    return service.spec.externalIPs.join(',')
  }
  return '<none>'
}

/**
 * Format service ports for display
 * Example: "80/TCP" or "80/TCP,443/TCP"
 */
const formatServicePorts = (service: Service): string => {
  if (!service.spec.ports || service.spec.ports.length === 0) {
    return '<none>'
  }
  return service.spec.ports
    .map((port) => {
      const portStr = port.nodePort
        ? `${port.nodePort}:${port.port}`
        : String(port.port)
      const protocol = port.protocol || 'TCP'
      return `${portStr}/${protocol}`
    })
    .join(',')
}

const formatIngressClass = (ingress: Ingress): string => {
  return ingress.spec.ingressClassName ?? '<none>'
}

const formatIngressHosts = (ingress: Ingress): string => {
  const hosts = ingress.spec.rules
    .map((rule) => rule.host)
    .filter((host): host is string => host != null && host.length > 0)
  if (hosts.length === 0) {
    return '*'
  }
  return hosts.join(',')
}

const formatIngressPorts = (): string => {
  return '80'
}

const formatNodeSelector = (selector?: Record<string, string>): string => {
  if (selector == null) {
    return '<none>'
  }
  const entries = Object.entries(selector)
  if (entries.length === 0) {
    return '<none>'
  }
  return entries
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join(',')
}

/**
 * Remove internal simulator properties from resource for output
 * Pure function that strips _simulator and other internal fields
 */
const sanitizeForOutput = <T extends Record<string, unknown>>(
  resource: T
): Omit<T, '_simulator'> => {
  const { _simulator, ...rest } = resource as T & { _simulator?: unknown }
  return rest as Omit<T, '_simulator'>
}

const RESOURCE_OUTPUT_METADATA: Record<
  StructuredResource,
  ResourceOutputMetadata
> = {
  pods: { apiVersion: 'v1', kind: 'Pod' },
  configmaps: { apiVersion: 'v1', kind: 'ConfigMap' },
  secrets: { apiVersion: 'v1', kind: 'Secret' },
  nodes: { apiVersion: 'v1', kind: 'Node' },
  replicasets: { apiVersion: 'apps/v1', kind: 'ReplicaSet' },
  deployments: { apiVersion: 'apps/v1', kind: 'Deployment' },
  daemonsets: { apiVersion: 'apps/v1', kind: 'DaemonSet' },
  services: { apiVersion: 'v1', kind: 'Service' },
  ingresses: { apiVersion: 'networking.k8s.io/v1', kind: 'Ingress' },
  ingressclasses: { apiVersion: 'networking.k8s.io/v1', kind: 'IngressClass' },
  namespaces: { apiVersion: 'v1', kind: 'Namespace' },
  persistentvolumes: { apiVersion: 'v1', kind: 'PersistentVolume' },
  persistentvolumeclaims: { apiVersion: 'v1', kind: 'PersistentVolumeClaim' }
}

const getResourceOutputMetadata = (
  resourceType: StructuredResource
): ResourceOutputMetadata => {
  return RESOURCE_OUTPUT_METADATA[resourceType]
}

const buildListOutput = <T>(
  resourceType: StructuredResource,
  items: T[]
): ResourceListOutput<T> => {
  const metadata = getResourceOutputMetadata(resourceType)
  return {
    apiVersion: metadata.apiVersion,
    items,
    kind: 'List',
    metadata: {
      resourceVersion: ''
    }
  }
}

const shapeStructuredItemsForOutput = (
  resourceType: StructuredResource,
  items: unknown[]
): unknown[] => {
  if (resourceType === 'pods') {
    return items.map((item) => {
      return shapePodForStructuredOutput(item as Pod)
    })
  }
  if (resourceType === 'deployments') {
    return items.map((item) => {
      return shapeDeploymentForStructuredOutput(item as Deployment)
    })
  }
  return items
}

const KIND_REFERENCE_BY_RESOURCE: Record<Resource, string> = {
  all: 'resource',
  pods: 'pod',
  configmaps: 'configmap',
  secrets: 'secret',
  nodes: 'node',
  replicasets: 'replicaset.apps',
  daemonsets: 'daemonset.apps',
  deployments: 'deployment.apps',
  services: 'service',
  ingresses: 'ingress.networking.k8s.io',
  ingressclasses: 'ingressclass.networking.k8s.io',
  namespaces: 'namespace',
  persistentvolumes: 'persistentvolume',
  persistentvolumeclaims: 'persistentvolumeclaim'
}

const PLURAL_KIND_REFERENCE_BY_RESOURCE: Record<Resource, string> = {
  all: 'resources',
  pods: 'pods',
  configmaps: 'configmaps',
  secrets: 'secrets',
  nodes: 'nodes',
  replicasets: 'replicasets.apps',
  daemonsets: 'daemonsets.apps',
  deployments: 'deployments.apps',
  services: 'services',
  ingresses: 'ingresses.networking.k8s.io',
  ingressclasses: 'ingressclasses.networking.k8s.io',
  namespaces: 'namespaces',
  persistentvolumes: 'persistentvolumes',
  persistentvolumeclaims: 'persistentvolumeclaims'
}

const buildNotFoundErrorMessage = (
  resourceType: Resource,
  name: string
): string => {
  const pluralReference = PLURAL_KIND_REFERENCE_BY_RESOURCE[resourceType]
  return `Error from server (NotFound): ${pluralReference} "${name}" not found`
}

const buildNameOutput = (
  resourceType: Resource,
  resources: ResourceWithMetadata[]
): string => {
  const kindReference = KIND_REFERENCE_BY_RESOURCE[resourceType]
  const lines = resources.map((resource) => {
    return `${kindReference}/${resource.metadata.name}`
  })
  return lines.join('\n')
}

/**
 * READY column: readyContainers/totalContainers (regular containers only, not init)
 */
const getPodReady = (pod: Pod): string => {
  const statuses = pod.status.containerStatuses ?? []
  const regular = pod.spec.containers.length
  if (regular === 0) {
    return '0/0'
  }
  const ready = statuses.filter((cs) => cs.ready).length
  return `${ready}/${regular}`
}

/**
 * RESTARTS column: sum of container restart counts
 */
const getPodRestarts = (pod: Pod): number => {
  const statuses = pod.status.containerStatuses ?? []
  return statuses.reduce((sum, cs) => sum + (cs.restartCount ?? 0), 0)
}

/**
 * STATUS column: phase or container state reason (e.g. Pending, Running, CrashLoopBackOff)
 */
const getPodDisplayStatus = (pod: Pod): string => {
  if (pod.status.phase === 'Running') {
    return 'Running'
  }
  const statuses = pod.status.containerStatuses ?? []
  const withReason = statuses.find(
    (cs) => cs.waitingReason != null || cs.terminatedReason != null
  )
  if (withReason?.waitingReason != null) {
    return withReason.waitingReason
  }
  if (withReason?.terminatedReason != null) {
    return withReason.terminatedReason
  }
  return pod.status.phase
}

const getPodIP = (pod: Pod): string => {
  if (pod.status.podIP != null && pod.status.podIP.length > 0) {
    return pod.status.podIP
  }
  const statuses = pod.status.containerStatuses ?? []
  if (statuses.length === 0) {
    return '<none>'
  }

  const hashSource = `${pod.metadata.namespace}/${pod.metadata.name}`
  let hash = 0
  for (let i = 0; i < hashSource.length; i++) {
    hash = (hash << 5) - hash + hashSource.charCodeAt(i)
    hash = hash & hash
  }
  const thirdOctet = (Math.abs(hash) % 240) + 10
  const fourthOctet = (Math.abs(hash >> 4) % 240) + 10
  return `10.244.${thirdOctet}.${fourthOctet}`
}

const getUniquePodIPMap = (pods: Pod[]): Map<string, string> => {
  const ipMap = new Map<string, string>()
  const usedIPs = new Set<string>()
  for (const pod of pods) {
    const key = `${pod.metadata.namespace}/${pod.metadata.name}`
    if (pod.status.podIP != null && pod.status.podIP.length > 0) {
      ipMap.set(key, pod.status.podIP)
      usedIPs.add(pod.status.podIP)
      continue
    }
    const statuses = pod.status.containerStatuses ?? []
    if (statuses.length === 0) {
      ipMap.set(key, '<none>')
      continue
    }
    const hashSource = key
    let hash = 0
    for (let index = 0; index < hashSource.length; index++) {
      hash = (hash << 5) - hash + hashSource.charCodeAt(index)
      hash = hash & hash
    }
    let thirdOctet = (Math.abs(hash) % 240) + 10
    let fourthOctet = (Math.abs(hash >> 4) % 240) + 10
    let candidate = `10.244.${thirdOctet}.${fourthOctet}`
    let attempt = 0
    while (usedIPs.has(candidate)) {
      attempt = attempt + 1
      thirdOctet = ((thirdOctet + attempt) % 240) + 10
      fourthOctet = ((fourthOctet + attempt * 7) % 240) + 10
      candidate = `10.244.${thirdOctet}.${fourthOctet}`
    }
    usedIPs.add(candidate)
    ipMap.set(key, candidate)
  }
  return ipMap
}

const getPodNodeName = (pod: Pod): string => {
  if (typeof pod.spec.nodeName === 'string' && pod.spec.nodeName.length > 0) {
    return pod.spec.nodeName
  }
  return '<none>'
}

const formatLabelsForDisplay = (labels?: Record<string, string>): string => {
  if (labels == null) {
    return '<none>'
  }
  const entries = Object.entries(labels)
  if (entries.length === 0) {
    return '<none>'
  }
  return entries
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join(',')
}

// ─── Resource Handlers Configuration ─────────────────────────────────────
// Object lookup pattern (like executor.ts) - add new resource = add config

const RESOURCE_HANDLERS: Record<string, ResourceHandler<any>> = {
  pods: {
    getItems: (state) => state.pods.items,
    headers: ['name', 'ready', 'status', 'restarts', 'age'],
    formatRow: (pod: Pod) => [
      pod.metadata.name,
      getPodReady(pod),
      getPodDisplayStatus(pod),
      String(getPodRestarts(pod)),
      formatAge(pod.metadata.creationTimestamp)
    ],
    supportsFiltering: true,
    align: ['left', 'right', 'left', 'right', 'right'],
    headersWide: [
      'name',
      'ready',
      'status',
      'restarts',
      'age',
      'ip',
      'node',
      'nominated node',
      'readiness gates'
    ],
    formatRowWide: (pod: Pod) => [
      pod.metadata.name,
      getPodReady(pod),
      getPodDisplayStatus(pod),
      String(getPodRestarts(pod)),
      formatAge(pod.metadata.creationTimestamp),
      getPodIP(pod),
      getPodNodeName(pod),
      '<none>',
      '<none>'
    ]
  },

  configmaps: {
    getItems: (state) => state.configMaps.items,
    headers: ['name', 'data', 'age'],
    formatRow: (cm: ConfigMap) => [
      cm.metadata.name,
      Object.keys(cm.data || {}).length.toString(),
      formatAge(cm.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },

  secrets: {
    getItems: (state) => state.secrets.items,
    headers: ['name', 'type', 'data', 'age'],
    formatRow: (secret: Secret) => [
      secret.metadata.name,
      getSecretType(secret.type),
      Object.keys(secret.data || {}).length.toString(),
      formatAge(secret.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },

  nodes: {
    getItems: (state) => state.nodes.items,
    headers: ['name', 'status', 'roles', 'age', 'version'],
    formatRow: (node: Node) => [
      node.metadata.name,
      getNodeStatus(node),
      getNodeRoles(node),
      formatAge(node.metadata.creationTimestamp),
      node.status.nodeInfo.kubeletVersion
    ],
    supportsFiltering: true,
    isClusterScoped: true,
    formatRowWide: (node: Node) => [
      node.metadata.name,
      getNodeStatus(node),
      getNodeRoles(node),
      formatAge(node.metadata.creationTimestamp),
      node.status.nodeInfo.kubeletVersion,
      getNodeInternalIP(node),
      getNodeExternalIP(node),
      node.status.nodeInfo.osImage,
      node.status.nodeInfo.kernelVersion,
      node.status.nodeInfo.containerRuntimeVersion
    ],
    headersWide: [
      'name',
      'status',
      'roles',
      'age',
      'version',
      'internal-ip',
      'external-ip',
      'os-image',
      'kernel-version',
      'container-runtime'
    ]
  },

  replicasets: {
    getItems: (state) => state.replicaSets.items,
    headers: ['name', 'desired', 'current', 'ready', 'age'],
    formatRow: (rs: ReplicaSet) => [
      rs.metadata.name,
      String(getReplicaSetDesiredReplicas(rs)),
      String(rs.status.replicas),
      String(rs.status.readyReplicas ?? 0),
      formatAge(rs.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },

  daemonsets: {
    getItems: (state) => state.daemonSets.items,
    headers: [
      'name',
      'desired',
      'current',
      'ready',
      'up-to-date',
      'available',
      'node selector',
      'age'
    ],
    formatRow: (daemonSet: DaemonSet) => [
      daemonSet.metadata.name,
      String(daemonSet.status.desiredNumberScheduled ?? 0),
      String(daemonSet.status.currentNumberScheduled ?? 0),
      String(daemonSet.status.numberReady ?? 0),
      String(daemonSet.status.currentNumberScheduled ?? 0),
      String(daemonSet.status.numberReady ?? 0),
      formatNodeSelector(daemonSet.spec.template.spec.nodeSelector),
      formatAge(daemonSet.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },

  deployments: {
    getItems: (state) => state.deployments.items,
    headers: ['name', 'ready', 'up-to-date', 'available', 'age'],
    formatRow: (deploy: Deployment) => [
      deploy.metadata.name,
      `${deploy.status.readyReplicas ?? 0}/${getDeploymentDesiredReplicas(deploy)}`,
      String(deploy.status.updatedReplicas ?? 0),
      String(deploy.status.availableReplicas ?? 0),
      formatAge(deploy.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },

  services: {
    getItems: (state) => state.services.items,
    headers: ['name', 'type', 'cluster-ip', 'external-ip', 'port(s)', 'age'],
    formatRow: (svc: Service) => [
      svc.metadata.name,
      getServiceType(svc),
      svc.spec.clusterIP || '<none>',
      getServiceExternalIP(svc),
      formatServicePorts(svc),
      formatAge(svc.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },

  ingresses: {
    getItems: (state) => state.ingresses.items,
    headers: ['name', 'class', 'hosts', 'address', 'ports', 'age'],
    formatRow: (ingress: Ingress) => [
      ingress.metadata.name,
      formatIngressClass(ingress),
      formatIngressHosts(ingress),
      '<none>',
      formatIngressPorts(),
      formatAge(ingress.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },

  ingressclasses: {
    getItems: (_state) => [],
    headers: ['name', 'controller', 'parameters', 'age'],
    formatRow: () => ['<none>', '<none>', '<none>', '<none>'],
    supportsFiltering: true,
    isClusterScoped: true
  },

  namespaces: {
    getItems: (state) => state.namespaces.items,
    headers: ['name', 'status', 'age'],
    formatRow: (namespace: Namespace) => [
      namespace.metadata.name,
      'Active',
      formatAge(namespace.metadata.creationTimestamp)
    ],
    supportsFiltering: true,
    isClusterScoped: true
  },

  persistentvolumes: {
    getItems: (state) => state.persistentVolumes.items,
    headers: [
      'name',
      'capacity',
      'access modes',
      'reclaim policy',
      'status',
      'claim'
    ],
    formatRow: (pv: PersistentVolume) => [
      pv.metadata.name,
      pv.spec.capacity.storage,
      pv.spec.accessModes.join(','),
      pv.spec.persistentVolumeReclaimPolicy ?? 'Retain',
      pv.status.phase,
      pv.spec.claimRef != null
        ? `${pv.spec.claimRef.namespace}/${pv.spec.claimRef.name}`
        : '<none>'
    ],
    supportsFiltering: true,
    isClusterScoped: true
  },

  persistentvolumeclaims: {
    getItems: (state) => state.persistentVolumeClaims.items,
    headers: [
      'name',
      'status',
      'volume',
      'capacity',
      'access modes',
      'storageclass',
      'age'
    ],
    formatRow: (pvc: PersistentVolumeClaim) => [
      pvc.metadata.name,
      pvc.status.phase,
      pvc.spec.volumeName ?? '<none>',
      pvc.spec.resources.requests.storage,
      pvc.spec.accessModes.join(','),
      pvc.spec.storageClassName ?? '<none>',
      formatAge(pvc.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  }
}

// ─── Special Cases ───────────────────────────────────────────────────────
// Resources that don't follow standard pattern (hardcoded data, no filtering)

const SPECIAL_HANDLERS: Record<string, () => string> = {}

// ─── Main Handler ────────────────────────────────────────────────────────

/**
 * Handle kubectl get command
 * Strategy pattern: delegate to resource-specific handler configuration
 */
export const handleGet = (
  state: ClusterStateData,
  parsed: ParsedCommand
): string => {
  if (typeof parsed.rawPath === 'string') {
    return handleGetRaw(state, parsed.rawPath)
  }

  if (parsed.resource === 'all') {
    return handleGetAll(state, parsed)
  }

  // Validate resource type
  if (!parsed.resource) {
    return noResourcesMessage('default', false)
  }

  const resourceType = parsed.resource

  // Check special handlers first (no filtering, hardcoded responses)
  const specialHandler = SPECIAL_HANDLERS[resourceType]
  if (specialHandler) {
    return specialHandler()
  }

  // Standard resource handling with filtering
  const handler = RESOURCE_HANDLERS[resourceType]
  if (!handler) {
    return noResourcesMessage('default', false)
  }

  // Get items and apply filters (--all-namespaces => no namespace filter for namespaced resources)
  const allNamespacesFlag =
    parsed.flags['all-namespaces'] === true || parsed.flags['A'] === true
  const effectiveNamespace = parsed.namespace ?? 'default'
  const filterNamespace = allNamespacesFlag ? undefined : effectiveNamespace
  const outputDirectiveResult = validateOutputDirective(
    resolveOutputDirective(parsed.flags, parsed.output),
    ['table', 'json', 'yaml', 'wide', 'name', 'jsonpath'],
    "--output must be one of: json|yaml|wide|name|jsonpath"
  )
  if (!outputDirectiveResult.ok) {
    return `error: ${outputDirectiveResult.error}`
  }
  const outputDirective = outputDirectiveResult.value
  const isStructuredOutput =
    outputDirective.kind === 'json' ||
    outputDirective.kind === 'yaml' ||
    outputDirective.kind === 'jsonpath'
  const items = handler.getItems(state)
  const isClusterScoped = handler.isClusterScoped || false
  const queryNames =
    parsed.names != null && parsed.names.length > 0 ? parsed.names : undefined
  const baseFiltered = applyFilters(
    items,
    filterNamespace,
    parsed.selector,
    isClusterScoped,
    queryNames == null ? parsed.name : undefined
  )
  const missingNameErrors: string[] = []
  const filtered = queryNames != null
    ? queryNames.reduce<typeof baseFiltered>((acc, name) => {
        const matched = baseFiltered.find((resource) => {
          return resource.metadata.name === name
        })
        if (matched == null) {
          missingNameErrors.push(buildNotFoundErrorMessage(resourceType, name))
          return acc
        }
        return [...acc, matched]
      }, [])
    : baseFiltered

  // Empty result (use effectiveNamespace for message unless --all-namespaces was explicitly set)
  if (filtered.length === 0) {
    if (missingNameErrors.length > 0) {
      return missingNameErrors.join('\n')
    }
    if (resourceType === 'namespaces' && parsed.name !== undefined) {
      return `Error from server (NotFound): namespaces "${parsed.name}" not found`
    }
    if (isStructuredOutput && parsed.name === undefined) {
      const structuredPayload = buildListOutput(resourceType, [])
      const renderResult = renderStructuredPayload(
        structuredPayload,
        outputDirective
      )
      if (!renderResult.ok) {
        return renderResult.error
      }
      return renderResult.value
    }
    return noResourcesMessage(
      allNamespacesFlag ? undefined : effectiveNamespace,
      isClusterScoped
    )
  }

  // Sanitize resources for output (remove _simulator)
  const sanitized = filtered.map(sanitizeForOutput)

  if (isStructuredOutput) {
    const asSingleObject =
      queryNames != null ? queryNames.length === 1 : parsed.name !== undefined
    const structuredResourceType = resourceType as StructuredResource
    const shaped = shapeStructuredItemsForOutput(
      structuredResourceType,
      sanitized
    )
    const structuredPayload = asSingleObject
      ? shaped[0]
      : buildListOutput(structuredResourceType, shaped)
    const renderResult = renderStructuredPayload(
      structuredPayload,
      outputDirective
    )
    if (!renderResult.ok) {
      return renderResult.error
    }
    if (missingNameErrors.length > 0) {
      return `${renderResult.value}\n${missingNameErrors.join('\n')}`
    }
    return renderResult.value
  }

  if (outputDirective.kind === 'name') {
    const nameOutput = buildNameOutput(resourceType, filtered)
    if (missingNameErrors.length > 0) {
      return `${nameOutput}\n${missingNameErrors.join('\n')}`
    }
    return nameOutput
  }

  // Default: table format
  // For pods with --all-namespaces (-A), add NAMESPACE column and sort by namespace then name.
  // Applies to both default and wide formats.
  const isWide = outputDirective.kind === 'wide' || parsed.flags.wide === true
  const showLabels = parsed.flags['show-labels'] === true
  if (resourceType === ('pods' as Resource) && allNamespacesFlag) {
    const sorted = [...filtered].sort((a, b) => {
      const na = (a as Pod).metadata.namespace
      const nb = (b as Pod).metadata.namespace
      if (na !== nb) {
        return na.localeCompare(nb)
      }
      return (a as Pod).metadata.name.localeCompare((b as Pod).metadata.name)
    })

    const headersAllNs = isWide
      ? [
          'namespace',
          'name',
          'ready',
          'status',
          'restarts',
          'age',
          'ip',
          'node',
          'nominated node',
          'readiness gates'
        ]
      : ['namespace', 'name', 'ready', 'status', 'restarts', 'age']
    if (showLabels) {
      headersAllNs.push('labels')
    }
    const ipMap = getUniquePodIPMap(sorted as Pod[])
    const rowsAllNs = sorted.map((pod) => {
      const p = pod as Pod
      if (isWide) {
        const key = `${p.metadata.namespace}/${p.metadata.name}`
        const wideRow = [
          p.metadata.namespace,
          p.metadata.name,
          getPodReady(p),
          getPodDisplayStatus(p),
          String(getPodRestarts(p)),
          formatAge(p.metadata.creationTimestamp),
          ipMap.get(key) ?? getPodIP(p),
          getPodNodeName(p),
          '<none>',
          '<none>'
        ]
        if (showLabels) {
          wideRow.push(formatLabelsForDisplay(p.metadata.labels))
        }
        return wideRow
      }
      const defaultRow = [
        p.metadata.namespace,
        p.metadata.name,
        getPodReady(p),
        getPodDisplayStatus(p),
        String(getPodRestarts(p)),
        formatAge(p.metadata.creationTimestamp)
      ]
      if (showLabels) {
        defaultRow.push(formatLabelsForDisplay(p.metadata.labels))
      }
      return defaultRow
    })
    const tableOutput = formatTable(
      headersAllNs,
      rowsAllNs,
      withKubectlTableSpacing({ align: buildLeftAlign(headersAllNs.length) })
    )
    if (missingNameErrors.length > 0) {
      return `${tableOutput}\n${missingNameErrors.join('\n')}`
    }
    return tableOutput
  }

  if (allNamespacesFlag && !isClusterScoped) {
    const rowsSource = [...filtered].sort((left, right) => {
      if (left.metadata.namespace !== right.metadata.namespace) {
        return left.metadata.namespace.localeCompare(right.metadata.namespace)
      }
      return left.metadata.name.localeCompare(right.metadata.name)
    })
    const rows = (rowsSource.map(handler.formatRow) as string[][]).map(
      (row, index) => {
        const rowWithNamespace = [rowsSource[index].metadata.namespace, ...row]
        if (!showLabels) {
          return rowWithNamespace
        }
        return [
          ...rowWithNamespace,
          formatLabelsForDisplay(rowsSource[index].metadata.labels)
        ]
      }
    )
    const headers = ['namespace', ...handler.headers]
    if (showLabels) {
      headers.push('labels')
    }
    const tableOutput = formatTable(
      headers,
      rows,
      withKubectlTableSpacing({ align: buildLeftAlign(headers.length) })
    )
    if (missingNameErrors.length > 0) {
      return `${tableOutput}\n${missingNameErrors.join('\n')}`
    }
    return tableOutput
  }

  // Handle wide format
  if (isWide && handler.formatRowWide && handler.headersWide) {
    const headers = [...handler.headersWide]
    const rows = (filtered.map(handler.formatRowWide) as string[][]).map(
      (row, index) => {
        if (!showLabels) {
          return row
        }
        const resource = filtered[index]
        return [...row, formatLabelsForDisplay(resource.metadata.labels)]
      }
    )
    if (showLabels) {
      headers.push('labels')
    }
    const tableOutput = formatTable(
      headers,
      rows,
      withKubectlTableSpacing({ align: buildLeftAlign(headers.length) })
    )
    if (missingNameErrors.length > 0) {
      return `${tableOutput}\n${missingNameErrors.join('\n')}`
    }
    return tableOutput
  }

  const rowsSource =
    resourceType === ('deployments' as Resource)
      ? [...filtered].sort((a, b) =>
          a.metadata.name.localeCompare(b.metadata.name)
        )
      : filtered
  const rows = (rowsSource.map(handler.formatRow) as string[][]).map(
    (row, index) => {
      if (!showLabels) {
        return row
      }
      const resource = rowsSource[index]
      return [...row, formatLabelsForDisplay(resource.metadata.labels)]
    }
  )
  const headers = [...handler.headers]
  if (showLabels) {
    headers.push('labels')
  }
  const tableOptions = withKubectlTableSpacing({
    align: buildLeftAlign(headers.length)
  })
  const tableOutput = formatTable(headers, rows, tableOptions)
  if (missingNameErrors.length > 0) {
    return `${tableOutput}\n${missingNameErrors.join('\n')}`
  }
  return tableOutput
}

type GetAllResourceType =
  | 'pods'
  | 'services'
  | 'deployments'
  | 'daemonsets'
  | 'replicasets'

const GET_ALL_RESOURCE_ORDER: GetAllResourceType[] = [
  'pods',
  'services',
  'daemonsets',
  'deployments',
  'replicasets'
]

const GET_ALL_REFERENCE_BY_RESOURCE: Record<GetAllResourceType, string> = {
  pods: 'pod',
  services: 'service',
  deployments: 'deployment.apps',
  daemonsets: 'daemonset.apps',
  replicasets: 'replicaset.apps'
}

interface GetAllContext {
  allNamespacesFlag: boolean
  effectiveNamespace: string
  filterNamespace: string | undefined
}

const buildGetAllContext = (parsed: ParsedCommand): GetAllContext => {
  const allNamespacesFlag =
    parsed.flags['all-namespaces'] === true || parsed.flags['A'] === true
  const effectiveNamespace = parsed.namespace ?? 'default'
  const filterNamespace = allNamespacesFlag ? undefined : effectiveNamespace
  return {
    allNamespacesFlag,
    effectiveNamespace,
    filterNamespace
  }
}

const sortGetAllItems = (
  resourceType: GetAllResourceType,
  items: ResourceWithMetadata[],
  allNamespacesFlag: boolean
): ResourceWithMetadata[] => {
  if (resourceType === 'pods' && allNamespacesFlag) {
    return [...items].sort((left, right) => {
      if (left.metadata.namespace !== right.metadata.namespace) {
        return left.metadata.namespace.localeCompare(right.metadata.namespace)
      }
      return left.metadata.name.localeCompare(right.metadata.name)
    })
  }
  if (resourceType === 'deployments') {
    return [...items].sort((left, right) =>
      left.metadata.name.localeCompare(right.metadata.name)
    )
  }
  return items
}

const buildGetAllRows = (
  resourceType: GetAllResourceType,
  items: ResourceWithMetadata[],
  handler: ResourceHandler<ResourceWithMetadata>,
  allNamespacesFlag: boolean,
  showLabels: boolean
): string[][] => {
  const rowsSource = sortGetAllItems(resourceType, items, allNamespacesFlag)
  return rowsSource.map((item) => {
    const row = handler.formatRow(item)
    const nameReference = GET_ALL_REFERENCE_BY_RESOURCE[resourceType]
    const rowWithReference = [...row]
    rowWithReference[0] = `${nameReference}/${item.metadata.name}`
    if (showLabels) {
      rowWithReference.push(formatLabelsForDisplay(item.metadata.labels))
    }
    if (allNamespacesFlag) {
      return [item.metadata.namespace, ...rowWithReference]
    }
    return rowWithReference
  })
}

const buildGetAllHeaders = (
  allNamespacesFlag: boolean,
  handler: ResourceHandler<ResourceWithMetadata>,
  showLabels: boolean
): string[] => {
  const headers = [...handler.headers]
  if (showLabels) {
    headers.push('labels')
  }
  if (allNamespacesFlag) {
    return ['namespace', ...headers]
  }
  return headers
}

const buildGetAllTableOptions = (
  allNamespacesFlag: boolean,
  handler: ResourceHandler<ResourceWithMetadata>,
  showLabels: boolean
): { spacing: number; align?: ('left' | 'right')[] } => {
  const namespaceColumns = allNamespacesFlag ? 1 : 0
  const labelsColumns = showLabels ? 1 : 0
  const totalColumns = handler.headers.length + namespaceColumns + labelsColumns
  const align: ('left' | 'right')[] = Array.from(
    { length: totalColumns },
    () => 'left'
  )
  return withKubectlTableSpacing({ align })
}

const buildGetAllSection = (
  state: ClusterStateData,
  parsed: ParsedCommand,
  context: GetAllContext,
  resourceType: GetAllResourceType
): string | undefined => {
  const showLabels = parsed.flags['show-labels'] === true
  const handler = RESOURCE_HANDLERS[
    resourceType
  ] as ResourceHandler<ResourceWithMetadata>
  const items = handler.getItems(state)
  const filteredItems = applyFilters(
    items,
    context.filterNamespace,
    parsed.selector,
    false,
    parsed.name
  )
  if (filteredItems.length === 0) {
    return undefined
  }

  const headers = buildGetAllHeaders(
    context.allNamespacesFlag,
    handler,
    showLabels
  )
  const rows = buildGetAllRows(
    resourceType,
    filteredItems,
    handler,
    context.allNamespacesFlag,
    showLabels
  )
  const tableOptions = buildGetAllTableOptions(
    context.allNamespacesFlag,
    handler,
    showLabels
  )
  return formatTable(headers, rows, tableOptions)
}

const handleGetAll = (
  state: ClusterStateData,
  parsed: ParsedCommand
): string => {
  const context = buildGetAllContext(parsed)
  const sections: string[] = []

  for (const resourceType of GET_ALL_RESOURCE_ORDER) {
    const section = buildGetAllSection(state, parsed, context, resourceType)
    if (section != null) {
      sections.push(section)
    }
  }

  if (sections.length === 0) {
    return noResourcesMessage(
      context.allNamespacesFlag ? undefined : context.effectiveNamespace,
      false
    )
  }

  return sections.join('\n\n')
}
