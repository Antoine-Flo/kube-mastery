import type { ApiServerFacade } from '../api/ApiServerFacade'
import type { Node } from '../cluster/ressources/Node'
import type { Pod } from '../cluster/ressources/Pod'

export interface ContainerMetrics {
  readonly name: string
  readonly cpuMilli: number
  readonly memoryBytes: number
}

export interface PodMetrics {
  readonly namespace: string
  readonly podName: string
  readonly nodeName?: string
  readonly cpuMilli: number
  readonly memoryBytes: number
  readonly containers: readonly ContainerMetrics[]
}

export interface NodeMetrics {
  readonly nodeName: string
  readonly cpuMilli: number
  readonly memoryBytes: number
}

export interface MetricsProvider {
  listPodMetrics: () => readonly PodMetrics[]
  listNodeMetrics: () => readonly NodeMetrics[]
}

const MEBIBYTE = 1024 * 1024
const MIN_RUNNING_POD_CPU_MILLI = 1
const MIN_RUNNING_POD_MEMORY_BYTES = 18 * MEBIBYTE
const MIN_PENDING_POD_CPU_MILLI = 1
const MIN_PENDING_POD_MEMORY_BYTES = 8 * MEBIBYTE
const CONTROL_PLANE_NODE_SYSTEM_CPU_MILLI = 30
const WORKER_NODE_SYSTEM_CPU_MILLI = 25
const CONTROL_PLANE_NODE_SYSTEM_MEMORY_BYTES = 220 * MEBIBYTE
const WORKER_NODE_SYSTEM_MEMORY_BYTES = 150 * MEBIBYTE

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

const normalizePodPhaseWeight = (pod: Pod): number => {
  const phase = pod.status.phase
  if (phase === 'Running') {
    return 1
  }
  if (phase === 'Pending') {
    return 0.45
  }
  return 0
}

const stableHash = (value: string): number => {
  let hash = 0
  for (let index = 0; index < value.length; index++) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash)
}

const stableRangeValue = (
  key: string,
  minInclusive: number,
  maxInclusive: number
): number => {
  if (maxInclusive <= minInclusive) {
    return minInclusive
  }
  const span = maxInclusive - minInclusive + 1
  return minInclusive + (stableHash(key) % span)
}

const getSystemPodTargetUsage = (
  podName: string
): { cpuMilli: number; memoryBytes: number } | undefined => {
  if (podName.startsWith('coredns-')) {
    return {
      cpuMilli: stableRangeValue(podName, 2, 4),
      memoryBytes: stableRangeValue(podName, 28, 72) * MEBIBYTE
    }
  }
  if (podName.startsWith('kindnet-')) {
    return {
      cpuMilli: stableRangeValue(podName, 3, 10),
      memoryBytes: stableRangeValue(podName, 14, 36) * MEBIBYTE
    }
  }
  if (podName.startsWith('kube-proxy-')) {
    return {
      cpuMilli: stableRangeValue(podName, 1, 3),
      memoryBytes: stableRangeValue(podName, 50, 70) * MEBIBYTE
    }
  }
  if (podName.startsWith('kube-apiserver-')) {
    return {
      cpuMilli: stableRangeValue(podName, 18, 35),
      memoryBytes: stableRangeValue(podName, 260, 340) * MEBIBYTE
    }
  }
  if (podName.startsWith('kube-controller-manager-')) {
    return {
      cpuMilli: stableRangeValue(podName, 10, 18),
      memoryBytes: stableRangeValue(podName, 100, 150) * MEBIBYTE
    }
  }
  if (podName.startsWith('kube-scheduler-')) {
    return {
      cpuMilli: stableRangeValue(podName, 3, 10),
      memoryBytes: stableRangeValue(podName, 60, 90) * MEBIBYTE
    }
  }
  if (podName.startsWith('etcd-')) {
    return {
      cpuMilli: stableRangeValue(podName, 12, 24),
      memoryBytes: stableRangeValue(podName, 70, 120) * MEBIBYTE
    }
  }
  if (podName.startsWith('local-path-provisioner-')) {
    return {
      cpuMilli: stableRangeValue(podName, 1, 4),
      memoryBytes: stableRangeValue(podName, 8, 16) * MEBIBYTE
    }
  }
  return undefined
}

const deriveGenericContainerUsage = (
  pod: Pod,
  containerIndex: number
): { cpuMilli: number; memoryBytes: number } => {
  const container = pod.spec.containers[containerIndex]
  const phaseWeight = normalizePodPhaseWeight(pod)
  const requestedCpuMilli = parseCpuToMilli(container.resources?.requests?.cpu)
  const limitedCpuMilli = parseCpuToMilli(container.resources?.limits?.cpu)
  const requestedMemoryBytes = parseMemoryToBytes(
    container.resources?.requests?.memory
  )
  const limitedMemoryBytes = parseMemoryToBytes(
    container.resources?.limits?.memory
  )

  const cpuFromRequests = Math.floor(requestedCpuMilli * 0.08 * phaseWeight)
  const cpuFromLimits = Math.floor(limitedCpuMilli * 0.05 * phaseWeight)
  const memoryFromRequests = Math.floor(
    requestedMemoryBytes * 0.55 * phaseWeight
  )
  const memoryFromLimits = Math.floor(limitedMemoryBytes * 0.45 * phaseWeight)
  const minCpuForPhase =
    phaseWeight < 1 ? MIN_PENDING_POD_CPU_MILLI : MIN_RUNNING_POD_CPU_MILLI
  const minMemoryForPhase =
    phaseWeight < 1
      ? MIN_PENDING_POD_MEMORY_BYTES
      : MIN_RUNNING_POD_MEMORY_BYTES

  return {
    cpuMilli: Math.max(minCpuForPhase, cpuFromRequests, cpuFromLimits),
    memoryBytes: Math.max(
      minMemoryForPhase,
      memoryFromRequests,
      memoryFromLimits
    )
  }
}

const buildContainerMetrics = (pod: Pod): readonly ContainerMetrics[] => {
  const phaseWeight = normalizePodPhaseWeight(pod)
  if (phaseWeight === 0) {
    return []
  }
  const systemTargetUsage = getSystemPodTargetUsage(pod.metadata.name)
  if (systemTargetUsage != null) {
    const containerCount = Math.max(1, pod.spec.containers.length)
    const perContainerCpu = Math.max(
      MIN_RUNNING_POD_CPU_MILLI,
      Math.floor(systemTargetUsage.cpuMilli / containerCount)
    )
    const perContainerMemory = Math.max(
      MIN_PENDING_POD_MEMORY_BYTES,
      Math.floor(systemTargetUsage.memoryBytes / containerCount)
    )
    return pod.spec.containers.map((container) => {
      return {
        name: container.name,
        cpuMilli: perContainerCpu,
        memoryBytes: perContainerMemory
      }
    })
  }
  return pod.spec.containers.map((container, containerIndex) => {
    const genericUsage = deriveGenericContainerUsage(pod, containerIndex)
    return {
      name: container.name,
      cpuMilli: genericUsage.cpuMilli,
      memoryBytes: genericUsage.memoryBytes
    }
  })
}

const toPodMetrics = (pod: Pod): PodMetrics | undefined => {
  const containers = buildContainerMetrics(pod)
  if (containers.length === 0) {
    return undefined
  }
  const cpuMilli = containers.reduce((total, container) => {
    return total + container.cpuMilli
  }, 0)
  const memoryBytes = containers.reduce((total, container) => {
    return total + container.memoryBytes
  }, 0)
  return {
    namespace: pod.metadata.namespace,
    podName: pod.metadata.name,
    nodeName: pod.spec.nodeName,
    cpuMilli,
    memoryBytes,
    containers
  }
}

const clampNodeUsage = (usage: number, allocatable: number): number => {
  if (allocatable <= 0) {
    return Math.max(0, usage)
  }
  const maxAllowed = Math.max(1, Math.floor(allocatable * 0.97))
  if (usage > maxAllowed) {
    return maxAllowed
  }
  return Math.max(0, usage)
}

const toNodeMetrics = (
  node: Node,
  podMetricsByNode: ReadonlyMap<string, readonly PodMetrics[]>
): NodeMetrics => {
  const nodeName = node.metadata.name
  const podMetrics = podMetricsByNode.get(nodeName) ?? []
  const podCpuMilli = podMetrics.reduce((total, podMetric) => {
    return total + podMetric.cpuMilli
  }, 0)
  const podMemoryBytes = podMetrics.reduce((total, podMetric) => {
    return total + podMetric.memoryBytes
  }, 0)

  const allocatableCpuMilli = parseCpuToMilli(node.status.allocatable?.cpu)
  const allocatableMemoryBytes = parseMemoryToBytes(
    node.status.allocatable?.memory
  )
  const isControlPlaneNode =
    node.metadata.labels?.['node-role.kubernetes.io/control-plane'] !==
      undefined || node.metadata.name.includes('control-plane')
  const cpuWithOverhead = isControlPlaneNode
    ? podCpuMilli + CONTROL_PLANE_NODE_SYSTEM_CPU_MILLI
    : podCpuMilli + WORKER_NODE_SYSTEM_CPU_MILLI
  const memoryWithOverhead = isControlPlaneNode
    ? podMemoryBytes + CONTROL_PLANE_NODE_SYSTEM_MEMORY_BYTES
    : podMemoryBytes + WORKER_NODE_SYSTEM_MEMORY_BYTES

  return {
    nodeName,
    cpuMilli: clampNodeUsage(cpuWithOverhead, allocatableCpuMilli),
    memoryBytes: clampNodeUsage(memoryWithOverhead, allocatableMemoryBytes)
  }
}

const buildPodMetricsByNode = (
  podMetrics: readonly PodMetrics[]
): Map<string, readonly PodMetrics[]> => {
  const byNode = new Map<string, readonly PodMetrics[]>()
  for (const metric of podMetrics) {
    if (metric.nodeName == null || metric.nodeName.length === 0) {
      continue
    }
    const current = byNode.get(metric.nodeName) ?? []
    byNode.set(metric.nodeName, [...current, metric])
  }
  return byNode
}

export const createMetricsProvider = (
  apiServer: ApiServerFacade
): MetricsProvider => {
  return {
    listPodMetrics: () => {
      const pods = apiServer.listResources('Pod')
      const metrics = pods
        .map((pod) => toPodMetrics(pod))
        .filter((metric): metric is PodMetrics => metric != null)
      return metrics
    },
    listNodeMetrics: () => {
      const nodes = apiServer.listResources('Node')
      const podMetrics = apiServer
        .listResources('Pod')
        .map((pod) => toPodMetrics(pod))
        .filter((metric): metric is PodMetrics => metric != null)
      const podMetricsByNode = buildPodMetricsByNode(podMetrics)
      return nodes.map((node) => toNodeMetrics(node, podMetricsByNode))
    }
  }
}
