import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { Node } from '../../../cluster/ressources/Node'
import type { Pod } from '../../../cluster/ressources/Pod'
import type {
  MetricsProvider,
  NodeMetrics
} from '../../../metrics/metricsProvider'
import { matchesLabelSelector } from '../../../shared/labelSelector'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import { formatKubectlTable } from '../output/outputHelpers'
import type { ParsedCommand } from '../types'

const MEBIBYTE = 1024 * 1024

const parseCpuToMilli = (value: string | undefined): number => {
  if (value == null || value.trim().length === 0) {
    return 0
  }
  const normalized = value.trim()
  if (normalized.endsWith('m')) {
    const milli = Number.parseInt(normalized.slice(0, -1), 10)
    if (!Number.isFinite(milli) || milli < 0) {
      return 0
    }
    return milli
  }
  const cores = Number.parseFloat(normalized)
  if (!Number.isFinite(cores) || cores < 0) {
    return 0
  }
  return Math.round(cores * 1000)
}

const parseMemoryToBytes = (value: string | undefined): number => {
  if (value == null || value.trim().length === 0) {
    return 0
  }
  const normalized = value.trim()
  const match = normalized.match(/^([0-9]+(?:\.[0-9]+)?)([KMGTEP]i?)?$/)
  if (match == null) {
    return 0
  }
  const amount = Number.parseFloat(match[1])
  if (!Number.isFinite(amount) || amount < 0) {
    return 0
  }
  const unit = match[2] ?? ''
  const multipliers: Record<string, number> = {
    '': 1,
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4,
    Pi: 1024 ** 5,
    Ei: 1024 ** 6,
    K: 1000,
    M: 1000 ** 2,
    G: 1000 ** 3,
    T: 1000 ** 4,
    P: 1000 ** 5,
    E: 1000 ** 6
  }
  const multiplier = multipliers[unit]
  if (multiplier == null) {
    return 0
  }
  return Math.round(amount * multiplier)
}

const formatCpu = (cpuMilli: number): string => {
  return `${Math.max(0, Math.round(cpuMilli))}m`
}

const formatMemory = (memoryBytes: number): string => {
  if (memoryBytes <= 0) {
    return '0Mi'
  }
  const mebibytes = Math.max(1, Math.floor(memoryBytes / MEBIBYTE))
  return `${mebibytes}Mi`
}

const formatPercent = (value: number, total: number): string => {
  if (total <= 0) {
    return '0%'
  }
  const percentage = Math.floor((value * 100) / total)
  return `${Math.max(0, percentage)}%`
}

const isAllNamespaces = (parsed: ParsedCommand): boolean => {
  return parsed.flags['all-namespaces'] === true || parsed.flags['A'] === true
}

const renderNoResourcesFound = (
  namespace: string | undefined,
  allNamespaces: boolean
): string => {
  if (allNamespaces || namespace == null) {
    return 'No resources found'
  }
  return `No resources found in ${namespace} namespace.`
}

const filterPods = (pods: readonly Pod[], parsed: ParsedCommand): Pod[] => {
  const allNamespaces = isAllNamespaces(parsed)
  const namespace = parsed.namespace
  const selector = parsed.selector

  return pods.filter((pod) => {
    if (
      !allNamespaces &&
      namespace != null &&
      pod.metadata.namespace !== namespace
    ) {
      return false
    }
    if (
      selector != null &&
      !matchesLabelSelector(selector, pod.metadata.labels)
    ) {
      return false
    }
    if (parsed.name != null && pod.metadata.name !== parsed.name) {
      return false
    }
    return true
  })
}

const filterNodes = (nodes: readonly Node[], parsed: ParsedCommand): Node[] => {
  return nodes.filter((node) => {
    if (
      parsed.selector != null &&
      !matchesLabelSelector(parsed.selector, node.metadata.labels)
    ) {
      return false
    }
    if (parsed.name != null && node.metadata.name !== parsed.name) {
      return false
    }
    return true
  })
}

const renderTopPods = (
  apiServer: ApiServerFacade,
  metricsProvider: MetricsProvider,
  parsed: ParsedCommand
): string => {
  const allNamespaces = isAllNamespaces(parsed)
  const filteredPods = filterPods(apiServer.listResources('Pod'), parsed)
  if (filteredPods.length === 0) {
    return renderNoResourcesFound(parsed.namespace, allNamespaces)
  }

  const sortedPods = [...filteredPods].sort((left, right) => {
    if (allNamespaces && left.metadata.namespace !== right.metadata.namespace) {
      return left.metadata.namespace.localeCompare(right.metadata.namespace)
    }
    return left.metadata.name.localeCompare(right.metadata.name)
  })

  const podMetrics = metricsProvider.listPodMetrics()
  const metricsByKey = new Map<string, number[]>()
  for (const metric of podMetrics) {
    const key = `${metric.namespace}/${metric.podName}`
    metricsByKey.set(key, [metric.cpuMilli, metric.memoryBytes])
  }

  const headers = allNamespaces
    ? ['NAMESPACE', 'NAME', 'CPU(cores)', 'MEMORY(bytes)']
    : ['NAME', 'CPU(cores)', 'MEMORY(bytes)']
  const rows = sortedPods.map((pod) => {
    const key = `${pod.metadata.namespace}/${pod.metadata.name}`
    const metric = metricsByKey.get(key) ?? [0, 0]
    if (allNamespaces) {
      return [
        pod.metadata.namespace,
        pod.metadata.name,
        formatCpu(metric[0]),
        formatMemory(metric[1])
      ]
    }
    return [pod.metadata.name, formatCpu(metric[0]), formatMemory(metric[1])]
  })

  return formatKubectlTable(headers, rows, { uppercase: false })
}

const getNodeMetric = (
  metricsByNode: ReadonlyMap<string, NodeMetrics>,
  nodeName: string
): NodeMetrics => {
  const existingMetric = metricsByNode.get(nodeName)
  if (existingMetric != null) {
    return existingMetric
  }
  return {
    nodeName,
    cpuMilli: 0,
    memoryBytes: 0
  }
}

const renderTopNodes = (
  apiServer: ApiServerFacade,
  metricsProvider: MetricsProvider,
  parsed: ParsedCommand
): string => {
  const filteredNodes = filterNodes(apiServer.listResources('Node'), parsed)
  if (filteredNodes.length === 0) {
    return 'No resources found'
  }

  const sortedNodes = [...filteredNodes].sort((left, right) => {
    return left.metadata.name.localeCompare(right.metadata.name)
  })
  const nodeMetrics = metricsProvider.listNodeMetrics()
  const metricsByNode = new Map<string, NodeMetrics>()
  for (const metric of nodeMetrics) {
    metricsByNode.set(metric.nodeName, metric)
  }

  const headers = ['NAME', 'CPU(cores)', 'CPU(%)', 'MEMORY(bytes)', 'MEMORY(%)']
  const rows = sortedNodes.map((node) => {
    const metric = getNodeMetric(metricsByNode, node.metadata.name)
    const allocatableCpu = parseCpuToMilli(node.status.allocatable?.cpu)
    const allocatableMemory = parseMemoryToBytes(
      node.status.allocatable?.memory
    )
    return [
      node.metadata.name,
      formatCpu(metric.cpuMilli),
      formatPercent(metric.cpuMilli, allocatableCpu),
      formatMemory(metric.memoryBytes),
      formatPercent(metric.memoryBytes, allocatableMemory)
    ]
  })

  return formatKubectlTable(headers, rows, { uppercase: false })
}

export const handleTop = (
  apiServer: ApiServerFacade,
  metricsProvider: MetricsProvider,
  parsed: ParsedCommand
): ExecutionResult => {
  if (parsed.action === 'top-pods') {
    return success(renderTopPods(apiServer, metricsProvider, parsed))
  }
  if (parsed.action === 'top-nodes') {
    return success(renderTopNodes(apiServer, metricsProvider, parsed))
  }
  return error('error: invalid top action')
}
