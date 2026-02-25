import { stringify as yamlStringify } from 'yaml'
import type { ParsedCommand } from '../types'
import type { ClusterStateData } from '../../../cluster/ClusterState'
import type { Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'

// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL CLUSTER-INFO HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Displays addresses of the control plane and services with label
// kubernetes.io/cluster-service=true
// Supports subcommand "dump" for debugging cluster information
// Matches the format of real kubectl cluster-info output

// ─── Constants ───────────────────────────────────────────────────────────────

const KUBECTL_JSON_INDENT = 4
const CLUSTER_INFO_NAMESPACE = 'kube-public'
const CLUSTER_INFO_CONFIGMAP_NAME = 'cluster-info'

const buildCoreDnsProxyUrl = (apiServerUrl: string): string => {
  const normalizedApiServerUrl = apiServerUrl.endsWith('/')
    ? apiServerUrl.slice(0, -1)
    : apiServerUrl
  return `${normalizedApiServerUrl}/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy`
}

const extractApiServerUrl = (kubeconfig: string): Result<string> => {
  const serverMatch = kubeconfig.match(/^\s*server:\s*(\S+)\s*$/m)
  if (!serverMatch) {
    return error(
      'cluster-info ConfigMap in kube-public is invalid: missing kubeconfig server URL'
    )
  }

  const serverUrl = serverMatch[1].trim()
  if (serverUrl.length === 0) {
    return error(
      'cluster-info ConfigMap in kube-public is invalid: empty kubeconfig server URL'
    )
  }

  return success(serverUrl)
}

const resolveClusterInfoUrls = (
  clusterState: ClusterStateData
): Result<{ apiServerUrl: string; coreDnsUrl: string }> => {
  const clusterInfoConfigMap = clusterState.configMaps.items.find((configMap) => {
    return (
      configMap.metadata.name === CLUSTER_INFO_CONFIGMAP_NAME &&
      configMap.metadata.namespace === CLUSTER_INFO_NAMESPACE
    )
  })

  if (!clusterInfoConfigMap) {
    return error(
      'cluster-info ConfigMap is missing in kube-public namespace'
    )
  }

  const kubeconfig = clusterInfoConfigMap.data?.kubeconfig
  if (!kubeconfig) {
    return error(
      'cluster-info ConfigMap in kube-public is invalid: missing data.kubeconfig'
    )
  }

  const apiServerUrlResult = extractApiServerUrl(kubeconfig)
  if (!apiServerUrlResult.ok) {
    return apiServerUrlResult
  }

  return success({
    apiServerUrl: apiServerUrlResult.value,
    coreDnsUrl: buildCoreDnsProxyUrl(apiServerUrlResult.value)
  })
}

// ─── Formatting Functions ────────────────────────────────────────────────

/**
 * Format a service line: "<name> is running at <url>"
 */
const formatServiceLine = (name: string, url: string): string => {
  return `${name} is running at ${url}`
}

// ─── Dump Functions (for cluster-info dump subcommand) ────────────────────

/**
 * Get output format from parsed command flags
 * Default for cluster-info dump is JSON (matching kubectl behavior)
 */
const getOutputFormat = (parsed: ParsedCommand): 'json' | 'yaml' => {
  const outputFlag = parsed.flags.output || parsed.flags['o']
  if (outputFlag === 'yaml') {
    return 'yaml'
  }
  // Default is JSON (matching kubectl cluster-info dump default)
  return 'json'
}

/**
 * Get namespaces to dump based on flags
 */
const getDumpNamespaces = (
  parsed: ParsedCommand,
  clusterState: ClusterStateData
): string[] => {
  // --all-namespaces takes precedence
  if (parsed.flags['all-namespaces'] === true || parsed.flags['A'] === true) {
    // Get all unique namespaces from pods, configmaps, secrets
    const namespaces = new Set<string>()
    clusterState.pods.items.forEach((pod) =>
      namespaces.add(pod.metadata.namespace)
    )
    clusterState.configMaps.items.forEach((cm) =>
      namespaces.add(cm.metadata.namespace)
    )
    clusterState.secrets.items.forEach((secret) =>
      namespaces.add(secret.metadata.namespace)
    )
    return Array.from(namespaces).sort()
  }

  // --namespaces flag
  const namespacesFlag = parsed.flags.namespaces
  if (namespacesFlag && typeof namespacesFlag === 'string') {
    return namespacesFlag.split(',').map((ns) => ns.trim())
  }

  // Default: current namespace (default) and kube-system
  return ['default', 'kube-system']
}

/**
 * Format resource as JSON
 */
const formatAsJson = (obj: unknown): string => {
  return JSON.stringify(obj, null, KUBECTL_JSON_INDENT)
}

/**
 * Format resource as YAML
 */
const formatAsYaml = (obj: unknown): string => {
  return yamlStringify(obj)
}

const createListDocument = <T>(
  kind: string,
  apiVersion: string,
  items: T[],
  includeMetadata = false
): {
  kind: string
  apiVersion: string
  metadata?: { resourceVersion: string }
  items: T[]
} => {
  if (includeMetadata) {
    return {
      kind,
      apiVersion,
      metadata: { resourceVersion: '0' },
      items
    }
  }
  return {
    kind,
    apiVersion,
    items
  }
}

/**
 * Dump pods for given namespace
 */
const dumpPods = (
  clusterState: ClusterStateData,
  namespace: string,
  format: 'json' | 'yaml'
): string => {
  const pods = clusterState.pods.items.filter(
    (pod) => pod.metadata.namespace === namespace
  )
  const list = { apiVersion: 'v1', kind: 'PodList', items: pods }

  if (format === 'yaml') {
    return formatAsYaml(list)
  }
  return formatAsJson(list)
}

/**
 * Dump ConfigMaps for given namespace
 */
const dumpConfigMaps = (
  clusterState: ClusterStateData,
  namespace: string,
  format: 'json' | 'yaml'
): string => {
  const configMaps = clusterState.configMaps.items.filter(
    (cm) => cm.metadata.namespace === namespace
  )
  const list = { apiVersion: 'v1', kind: 'ConfigMapList', items: configMaps }

  if (format === 'yaml') {
    return formatAsYaml(list)
  }
  return formatAsJson(list)
}

/**
 * Dump Secrets for given namespace
 */
const dumpSecrets = (
  clusterState: ClusterStateData,
  namespace: string,
  format: 'json' | 'yaml'
): string => {
  const secrets = clusterState.secrets.items.filter(
    (secret) => secret.metadata.namespace === namespace
  )
  const list = { apiVersion: 'v1', kind: 'SecretList', items: secrets }

  if (format === 'yaml') {
    return formatAsYaml(list)
  }
  return formatAsJson(list)
}

/**
 * Dump pod logs
 */
const dumpPodLogs = (
  clusterState: ClusterStateData,
  namespace: string
): string => {
  const pods = clusterState.pods.items.filter(
    (pod) => pod.metadata.namespace === namespace
  )
  const lines: string[] = []

  for (const pod of pods) {
    // Logs are stored in _simulator.logs (string[]), not in status.logs
    const logs = pod._simulator?.logs || []
    if (logs.length > 0) {
      lines.push(
        `==== START logs for pod ${pod.metadata.namespace}/${pod.metadata.name} ====`
      )
      for (const logLine of logs) {
        lines.push(logLine)
      }
      lines.push(
        `==== END logs for pod ${pod.metadata.namespace}/${pod.metadata.name} ====`
      )
      lines.push('')
    }
  }

  return lines.join('\n')
}

/**
 * Handle cluster-info dump subcommand
 * Format: JSON objects for resources, followed by logs as plain text
 */
const handleDump = (
  clusterState: ClusterStateData,
  parsed: ParsedCommand
): Result<string> => {
  // Note: --output-directory is not yet supported (would require file system access)
  const outputDir = parsed.flags['output-directory']
  if (outputDir && outputDir !== '-' && typeof outputDir === 'string') {
    return success(`Cluster info dumped to ${outputDir}`)
  }

  const outputFormat = getOutputFormat(parsed)
  const namespaces = getDumpNamespaces(parsed, clusterState)

  const parts: string[] = []

  // Dump nodes (empty NodeList for now - Nodes not yet supported in ClusterState)
  const nodeList = createListDocument(
    'NodeList',
    'v1',
    clusterState.nodes.items,
    true
  )
  if (outputFormat === 'json') {
    parts.push(formatAsJson(nodeList))
  } else {
    parts.push(formatAsYaml(nodeList))
  }

  // Dump resources per namespace (Events, ReplicationControllers, Services, DaemonSets, Deployments, ReplicaSets, Pods)
  for (const namespace of namespaces) {
    // Events (empty for now)
    const eventsList = createListDocument('EventList', 'v1', [])
    if (outputFormat === 'json') {
      parts.push(formatAsJson(eventsList))
    } else {
      parts.push(formatAsYaml(eventsList))
    }

    // ReplicationControllers (empty - not yet supported)
    const rcList = createListDocument('ReplicationControllerList', 'v1', [])
    if (outputFormat === 'json') {
      parts.push(formatAsJson(rcList))
    } else {
      parts.push(formatAsYaml(rcList))
    }

    // Services (empty - not yet supported)
    const svcList = createListDocument(
      'ServiceList',
      'v1',
      clusterState.services.items.filter(
        (service) => service.metadata.namespace === namespace
      )
    )
    if (outputFormat === 'json') {
      parts.push(formatAsJson(svcList))
    } else {
      parts.push(formatAsYaml(svcList))
    }

    // DaemonSets (empty - not yet supported)
    const dsList = createListDocument('DaemonSetList', 'apps/v1', [])
    if (outputFormat === 'json') {
      parts.push(formatAsJson(dsList))
    } else {
      parts.push(formatAsYaml(dsList))
    }

    // Deployments (empty - not yet supported)
    const depList = createListDocument(
      'DeploymentList',
      'apps/v1',
      clusterState.deployments.items.filter(
        (deployment) => deployment.metadata.namespace === namespace
      )
    )
    if (outputFormat === 'json') {
      parts.push(formatAsJson(depList))
    } else {
      parts.push(formatAsYaml(depList))
    }

    // ReplicaSets (empty - not yet supported)
    const rsList = createListDocument(
      'ReplicaSetList',
      'apps/v1',
      clusterState.replicaSets.items.filter(
        (replicaSet) => replicaSet.metadata.namespace === namespace
      )
    )
    if (outputFormat === 'json') {
      parts.push(formatAsJson(rsList))
    } else {
      parts.push(formatAsYaml(rsList))
    }

    // Pods
    parts.push(dumpPods(clusterState, namespace, outputFormat))

    // ConfigMaps
    parts.push(dumpConfigMaps(clusterState, namespace, outputFormat))

    // Secrets
    parts.push(dumpSecrets(clusterState, namespace, outputFormat))
  }

  // Dump logs as plain text (after all JSON/YAML resources)
  for (const namespace of namespaces) {
    const logsOutput = dumpPodLogs(clusterState, namespace)
    if (logsOutput) {
      parts.push(logsOutput)
    }
  }

  return success(parts.join('\n'))
}

// ─── Main Handler ────────────────────────────────────────────────────────

/**
 * Handle kubectl cluster-info command
 * Supports:
 * - kubectl cluster-info (displays control plane and services)
 * - kubectl cluster-info dump (dumps cluster information for debugging)
 */
export const handleClusterInfo = (
  clusterState: ClusterStateData,
  parsed: ParsedCommand
): Result<string> => {
  // Check if dump subcommand is present
  if (parsed.flags.dump === true) {
    return handleDump(clusterState, parsed)
  }

  // Default behavior: display cluster info
  const clusterInfoUrlsResult = resolveClusterInfoUrls(clusterState)
  if (!clusterInfoUrlsResult.ok) {
    return clusterInfoUrlsResult
  }

  const lines: string[] = []

  // Print control plane URL
  lines.push(
    formatServiceLine(
      'Kubernetes control plane',
      clusterInfoUrlsResult.value.apiServerUrl
    )
  )
  lines.push(formatServiceLine('CoreDNS', clusterInfoUrlsResult.value.coreDnsUrl))

  lines.push('')
  lines.push(
    "To further debug and diagnose cluster problems, use 'kubectl cluster-info dump'."
  )

  return success(lines.join('\n'))
}
