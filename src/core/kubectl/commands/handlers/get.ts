import { stringify as yamlStringify } from 'yaml'
import type { ClusterStateData } from '../../../cluster/ClusterState'
import type { ConfigMap } from '../../../cluster/ressources/ConfigMap'
import type { Deployment } from '../../../cluster/ressources/Deployment'
import { getDeploymentDesiredReplicas } from '../../../cluster/ressources/Deployment'
import type { Node } from '../../../cluster/ressources/Node'
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
    supportsFiltering: true
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
  }
}

// ─── Special Cases ───────────────────────────────────────────────────────
// Resources that don't follow standard pattern (hardcoded data, no filtering)

const SPECIAL_HANDLERS: Record<string, () => string> = {
  namespaces: () => {
    const headers = ['name', 'status', 'age']
    const rows = [
      ['default', 'Active', '5d'],
      ['kube-system', 'Active', '5d']
    ]
    return formatTable(headers, rows)
  }
}

// ─── Main Handler ────────────────────────────────────────────────────────

/**
 * Format nodes as JSON (NodeList structure)
 */
const formatNodesJson = (nodes: Node[]): string => {
  const nodeList = {
    apiVersion: 'v1',
    kind: 'NodeList',
    items: nodes,
    metadata: {
      resourceVersion: ''
    }
  }
  return JSON.stringify(nodeList, null, 2)
}

/**
 * Format nodes as YAML (NodeList structure)
 */
const formatNodesYaml = (nodes: Node[]): string => {
  const nodeList = {
    apiVersion: 'v1',
    kind: 'NodeList',
    items: nodes,
    metadata: {
      resourceVersion: ''
    }
  }
  return yamlStringify(nodeList)
}

/**
 * Format services as JSON (ServiceList structure)
 */
const formatServicesJson = (services: Service[]): string => {
  const serviceList = {
    apiVersion: 'v1',
    kind: 'ServiceList',
    items: services,
    metadata: {
      resourceVersion: ''
    }
  }
  return JSON.stringify(serviceList, null, 2)
}

/**
 * Format services as YAML (ServiceList structure)
 */
const formatServicesYaml = (services: Service[]): string => {
  const serviceList = {
    apiVersion: 'v1',
    kind: 'ServiceList',
    items: services,
    metadata: {
      resourceVersion: ''
    }
  }
  return yamlStringify(serviceList)
}

/**
 * Handle kubectl get command
 * Strategy pattern: delegate to resource-specific handler configuration
 */
export const handleGet = (
  state: ClusterStateData,
  parsed: ParsedCommand
): string => {
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
  const items = handler.getItems(state)
  const isClusterScoped = handler.isClusterScoped || false
  const filtered = applyFilters(
    items,
    filterNamespace,
    parsed.selector,
    isClusterScoped,
    parsed.name
  )

  // Empty result (use effectiveNamespace for message unless --all-namespaces was explicitly set)
  if (filtered.length === 0) {
    return noResourcesMessage(
      allNamespacesFlag ? undefined : effectiveNamespace,
      isClusterScoped
    )
  }

  // Check output format
  const explicitOutput = parsed.flags.output || parsed.flags['o']
  const outputFormat = explicitOutput
    ? (explicitOutput as string)
    : parsed.output

  // Sanitize resources for output (remove _simulator)
  const sanitized = filtered.map(sanitizeForOutput)

  // Handle JSON output
  if (outputFormat === 'json') {
    if (resourceType === ('nodes' as Resource)) {
      return formatNodesJson(sanitized as Node[])
    }
    if (resourceType === ('services' as Resource)) {
      return formatServicesJson(sanitized as Service[])
    }
    return JSON.stringify(sanitized, null, 2)
  }

  // Handle YAML output
  if (outputFormat === 'yaml') {
    if (resourceType === ('nodes' as Resource)) {
      return formatNodesYaml(sanitized as Node[])
    }
    if (resourceType === ('services' as Resource)) {
      return formatServicesYaml(sanitized as Service[])
    }
    return yamlStringify(sanitized)
  }

  // Handle wide format
  const isWide = outputFormat === 'wide' || parsed.flags.wide === true
  if (isWide && handler.formatRowWide && handler.headersWide) {
    const rows = filtered.map(handler.formatRowWide) as string[][]
    return formatTable(handler.headersWide, rows)
  }

  // Default: table format
  // For pods with --all-namespaces (-A), add NAMESPACE column and sort by namespace then name
  if (resourceType === ('pods' as Resource) && allNamespacesFlag) {
    const sorted = [...filtered].sort((a, b) => {
      const na = (a as Pod).metadata.namespace
      const nb = (b as Pod).metadata.namespace
      if (na !== nb) {
        return na.localeCompare(nb)
      }
      return (a as Pod).metadata.name.localeCompare((b as Pod).metadata.name)
    })
    const headersAllNs = [
      'namespace',
      'name',
      'ready',
      'status',
      'restarts',
      'age'
    ]
    const rowsAllNs = sorted.map((pod) => {
      const p = pod as Pod
      return [
        p.metadata.namespace,
        p.metadata.name,
        getPodReady(p),
        getPodDisplayStatus(p),
        String(getPodRestarts(p)),
        formatAge(p.metadata.creationTimestamp)
      ]
    })
    return formatTable(headersAllNs, rowsAllNs)
  }

  const rows = filtered.map(handler.formatRow) as string[][]
  return formatTable(handler.headers, rows)
}
