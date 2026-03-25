// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL DESCRIBE FORMATTERS
// ═══════════════════════════════════════════════════════════════════════════
// Pure functions for formatting detailed kubectl describe output.
// Reproduces real kubectl describe style with proper indentation and sections.

import type { ConfigMap } from '../../cluster/ressources/ConfigMap'
import type { ClusterStateData } from '../../cluster/ClusterState'
import type { PodLifecycleDescribeEvent } from '../../api/PodLifecycleEventStore'
import type {
  Deployment,
  DeploymentCondition,
  DeploymentStrategyType
} from '../../cluster/ressources/Deployment'
import type { EndpointSlice } from '../../cluster/ressources/EndpointSlice'
import type { Endpoints } from '../../cluster/ressources/Endpoints'
import type { Ingress } from '../../cluster/ressources/Ingress'
import type { Lease } from '../../cluster/ressources/Lease'
import type {
  Node,
  NodeCondition,
  NodeTaint
} from '../../cluster/ressources/Node'
import { getNodeRoles } from '../../cluster/ressources/Node'
import type { PersistentVolume } from '../../cluster/ressources/PersistentVolume'
import type { PersistentVolumeClaim } from '../../cluster/ressources/PersistentVolumeClaim'
import type { ReplicaSet } from '../../cluster/ressources/ReplicaSet'
import { selectorMatchesLabels } from '../../cluster/ressources/ReplicaSet'
import type {
  ContainerRuntimeStateDetails,
  ContainerStatus,
  EnvVar,
  Pod,
  PodToleration,
  Probe,
  Volume,
  VolumeMount
} from '../../cluster/ressources/Pod'
import { isPodTerminating } from '../../cluster/ressources/Pod'
import type { Secret } from '../../cluster/ressources/Secret'
import type { Service } from '../../cluster/ressources/Service'
import { formatAge } from '../../shared/formatter'
import { blank, indent, kv, section } from './describeHelpers'

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Format labels/annotations as comma-separated key=value pairs
 */
const formatLabels = (labels?: Record<string, string>): string => {
  if (!labels || Object.keys(labels).length === 0) {
    return '<none>'
  }
  return Object.entries(labels)
    .map(([key, value]) => `${key}=${value}`)
    .join(',')
}

const sortRecordEntries = (
  values?: Record<string, string>
): Array<[string, string]> => {
  if (values == null) {
    return []
  }
  return Object.entries(values).sort(([leftKey], [rightKey]) => {
    return leftKey.localeCompare(rightKey)
  })
}

const formatMapMultiLine = (
  key: string,
  values?: Record<string, string>,
  mode: 'equals' | 'colon' = 'equals',
  firstColumnWidth: number = 20
): string[] => {
  const entries = sortRecordEntries(values)
  const keyLabel = `${key}:`
  if (entries.length === 0) {
    return [`${keyLabel.padEnd(firstColumnWidth)}<none>`]
  }
  const first = entries[0]
  const firstValue =
    mode === 'colon' ? `${first[0]}: ${first[1]}` : `${first[0]}=${first[1]}`
  const lines: string[] = [`${keyLabel.padEnd(firstColumnWidth)}${firstValue}`]
  for (let index = 1; index < entries.length; index++) {
    const [entryKey, entryValue] = entries[index]
    const rendered =
      mode === 'colon'
        ? `${entryKey}: ${entryValue}`
        : `${entryKey}=${entryValue}`
    lines.push(`${' '.repeat(firstColumnWidth)}${rendered}`)
  }
  return lines
}

const sanitizeDescribeAnnotations = (
  annotations?: Record<string, string>
): Record<string, string> | undefined => {
  if (annotations == null) {
    return undefined
  }
  const filtered = Object.entries(annotations).filter(([key]) => {
    return key.startsWith('sim.kubernetes.io/') === false
  })
  if (filtered.length === 0) {
    return undefined
  }
  return Object.fromEntries(filtered)
}

/**
 * Simulate pod IP address
 * In real K8s this would be assigned by CNI plugin
 */
const simulatePodIP = (podName: string): string => {
  // Simple hash to generate consistent IP for same pod name
  let hash = 0
  for (let i = 0; i < podName.length; i++) {
    hash = (hash << 5) - hash + podName.charCodeAt(i)
    hash = hash & hash
  }
  const lastOctet = Math.abs(hash % 250) + 2
  return `172.17.0.${lastOctet}`
}

const formatDescribeDate = (isoDate: string): string => {
  const parsed = new Date(isoDate)
  if (isNaN(parsed.getTime())) {
    return isoDate
  }
  return parsed.toUTCString()
}

const getDescribePodStatus = (pod: Pod): string => {
  if (isPodTerminating(pod)) {
    return 'Terminating'
  }
  return pod.status.phase
}

const formatSelector = (selector: {
  matchLabels?: Record<string, string>
  matchExpressions?: Array<{
    key: string
    operator: string
    values?: string[]
  }>
}): string => {
  const selectorParts: string[] = []
  if (selector.matchLabels) {
    for (const [key, value] of Object.entries(selector.matchLabels)) {
      selectorParts.push(`${key}=${value}`)
    }
  }

  if (selector.matchExpressions) {
    for (const expr of selector.matchExpressions) {
      const values =
        expr.values && expr.values.length > 0 ? expr.values.join(',') : ''
      selectorParts.push(`${expr.key} ${expr.operator} (${values})`)
    }
  }

  if (selectorParts.length === 0) {
    return '<none>'
  }

  return selectorParts.join(',')
}

const formatIntOrString = (value: number | string | undefined): string => {
  if (value === undefined) {
    return '<none>'
  }
  return String(value)
}

const formatDeploymentReplicas = (deployment: Deployment): string => {
  const desired = deployment.spec.replicas ?? 1
  const updated = deployment.status.updatedReplicas ?? 0
  const total = deployment.status.replicas ?? 0
  const available = deployment.status.availableReplicas ?? 0
  const unavailable = deployment.status.unavailableReplicas ?? total - available
  return `${desired} desired | ${updated} updated | ${total} total | ${available} available | ${unavailable} unavailable`
}

const formatStrategyType = (
  strategyType: DeploymentStrategyType | undefined
): string => {
  if (!strategyType) {
    return 'RollingUpdate'
  }
  return strategyType
}

const formatTemplateEnv = (
  envVar:
    | EnvVar
    | {
        name: string
        value?: string
        valueFrom?: {
          configMapKeyRef?: { name: string; key: string }
          secretKeyRef?: { name: string; key: string }
        }
      },
  lines: string[]
): void => {
  if ('source' in envVar) {
    if (envVar.source.type === 'value') {
      lines.push(indent(`${envVar.name}:  ${envVar.source.value}`, 4))
      return
    }
    if (envVar.source.type === 'configMapKeyRef') {
      lines.push(
        indent(
          `${envVar.name}:  <set to the key '${envVar.source.key}' in config map '${envVar.source.name}'>`,
          4
        )
      )
      return
    }
    if (envVar.source.type === 'secretKeyRef') {
      lines.push(
        indent(
          `${envVar.name}:  <set to the key '${envVar.source.key}' of secret '${envVar.source.name}'>`,
          4
        )
      )
      return
    }
  }

  const legacyEnvVar = envVar as {
    name: string
    value?: string
    valueFrom?: {
      configMapKeyRef?: { name: string; key: string }
      secretKeyRef?: { name: string; key: string }
    }
  }

  if (legacyEnvVar.value !== undefined) {
    lines.push(indent(`${legacyEnvVar.name}:  ${legacyEnvVar.value}`, 4))
    return
  }

  if (legacyEnvVar.valueFrom?.configMapKeyRef) {
    lines.push(
      indent(
        `${legacyEnvVar.name}:  <set to the key '${legacyEnvVar.valueFrom.configMapKeyRef.key}' in config map '${legacyEnvVar.valueFrom.configMapKeyRef.name}'>`,
        4
      )
    )
    return
  }

  if (legacyEnvVar.valueFrom?.secretKeyRef) {
    lines.push(
      indent(
        `${legacyEnvVar.name}:  <set to the key '${legacyEnvVar.valueFrom.secretKeyRef.key}' of secret '${legacyEnvVar.valueFrom.secretKeyRef.name}'>`,
        4
      )
    )
    return
  }

  lines.push(indent(`${legacyEnvVar.name}:  <unknown>`, 4))
}

const formatDeploymentConditions = (
  conditions: DeploymentCondition[] | undefined
): string[] => {
  const lines: string[] = ['Conditions:']
  if (!conditions || conditions.length === 0) {
    lines.push('  <none>')
    return lines
  }

  lines.push('  Type           Status  Reason')
  for (const condition of conditions) {
    lines.push(
      `  ${condition.type.padEnd(14)} ${condition.status.padEnd(7)} ${condition.reason ?? '<none>'}`
    )
  }

  return lines
}

/**
 * Format probe configuration
 */
const formatProbe = (probe: Probe): string[] => {
  const lines: string[] = []

  if (probe.type === 'httpGet') {
    lines.push(`    http-get ${probe.path} on port ${probe.port}`)
  }

  if (probe.type === 'exec') {
    lines.push(`    exec [${probe.command.join(' ')}]`)
  }

  if (probe.type === 'tcpSocket') {
    lines.push(`    tcp-socket :${probe.port}`)
  }

  if (probe.initialDelaySeconds !== undefined) {
    lines.push(`    delay=${probe.initialDelaySeconds}s`)
  }

  if (probe.periodSeconds !== undefined) {
    lines.push(`    period=${probe.periodSeconds}s`)
  }

  return lines
}

/**
 * Format environment variable (mask secrets)
 */
const formatEnvVar = (env: EnvVar): string => {
  if (env.source.type === 'value') {
    return `    ${env.name}:  ${env.source.value}`
  }

  if (env.source.type === 'configMapKeyRef') {
    return `    ${env.name}:  <set to the key '${env.source.key}' in config map '${env.source.name}'>`
  }

  if (env.source.type === 'secretKeyRef') {
    return `    ${env.name}:  <set to the key '${env.source.key}' of secret '${env.source.name}'>`
  }

  return `    ${env.name}:  <unknown>`
}

/**
 * Format volume mount
 */
const formatVolumeMount = (mount: VolumeMount): string => {
  const readOnlyStr = mount.readOnly ? '(ro)' : '(rw)'
  return `      ${mount.mountPath} from ${mount.name} ${readOnlyStr}`
}

/**
 * Format volume source
 */
const formatVolumeSource = (volume: Volume): string => {
  if (!volume.source) {
    return `    Type:       Unknown`
  }

  if (volume.source.type === 'emptyDir') {
    const medium = volume.source.medium ?? '<unset>'
    const sizeLimit = volume.source.sizeLimit ?? '<unset>'
    return `    Type:       EmptyDir (a temporary directory that shares a pod's lifetime)\n    Medium:     ${medium}\n    SizeLimit:  ${sizeLimit}`
  }

  if (volume.source.type === 'hostPath') {
    return `    Type:       HostPath (bare host directory volume)\n    Path:       ${volume.source.path}\n    HostPathType: ${volume.source.hostPathType ?? '<unset>'}`
  }

  if (volume.source.type === 'persistentVolumeClaim') {
    return `    Type:       PersistentVolumeClaim (a reference to a PersistentVolumeClaim in the same namespace)\n    ClaimName:  ${volume.source.claimName}\n    ReadOnly:   ${volume.source.readOnly === true}`
  }

  if (volume.source.type === 'configMap') {
    return `    Type:       ConfigMap (a volume populated by a ConfigMap)\n    Name:       ${volume.source.name}\n    Optional:   false`
  }

  if (volume.source.type === 'secret') {
    return `    Type:       Secret (a volume populated by a Secret)\n    SecretName: ${volume.source.secretName}\n    Optional:   false`
  }

  return `    Type:       Unknown`
}

const stableHash = (value: string): string => {
  let hash = 0
  for (let index = 0; index < value.length; index++) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const buildKubeApiAccessVolumeName = (pod: Pod): string => {
  const token = stableHash(
    `${pod.metadata.namespace}/${pod.metadata.name}`
  ).slice(0, 5)
  return `kube-api-access-${token}`
}

/**
 * Format secret type for display
 */
const formatSecretType = (secretType: Secret['type']): string => {
  if (secretType.type === 'Opaque') {
    return 'Opaque'
  }

  if (secretType.type === 'kubernetes.io/service-account-token') {
    return 'kubernetes.io/service-account-token'
  }

  if (secretType.type === 'kubernetes.io/dockerconfigjson') {
    return 'kubernetes.io/dockerconfigjson'
  }

  return 'Unknown'
}

const formatNodeTaints = (taints: NodeTaint[] | undefined): string => {
  if (!taints || taints.length === 0) {
    return '<none>'
  }
  return taints
    .map((taint) => {
      const valuePart = taint.value ? `=${taint.value}` : ''
      return `${taint.key}${valuePart}:${taint.effect}`
    })
    .join(', ')
}

const formatNodeConditions = (
  conditions: NodeCondition[] | undefined
): string[] => {
  const lines: string[] = ['Conditions:']
  if (!conditions || conditions.length === 0) {
    lines.push('  <none>')
    return lines
  }

  lines.push(
    '  Type             Status  LastHeartbeatTime               LastTransitionTime              Reason                         Message'
  )
  lines.push(
    '  ----             ------  -----------------               ------------------              ------                         -------'
  )
  for (const condition of conditions) {
    const heartbeat = condition.lastHeartbeatTime
      ? formatDescribeDate(condition.lastHeartbeatTime)
      : '<none>'
    const transition = condition.lastTransitionTime
      ? formatDescribeDate(condition.lastTransitionTime)
      : '<none>'
    const reason = condition.reason ?? '<none>'
    const message = condition.message ?? '<none>'
    lines.push(
      `  ${condition.type.padEnd(16)} ${condition.status.padEnd(6)}  ${heartbeat.padEnd(31)} ${transition.padEnd(31)} ${reason.padEnd(30)} ${message}`
    )
  }
  return lines
}

const formatNodeAddresses = (
  addresses: Node['status']['addresses'] | undefined
): string[] => {
  const lines: string[] = ['Addresses:']
  if (!addresses || addresses.length === 0) {
    lines.push('  <none>')
    return lines
  }
  for (const address of addresses) {
    lines.push(`  ${`${address.type}:`.padEnd(12)}${address.address}`)
  }
  return lines
}

const formatNodeResourceList = (
  title: string,
  resources: Record<string, string> | undefined
): string[] => {
  if (!resources || Object.keys(resources).length === 0) {
    return [`${title}:`, '  <none>']
  }
  const lines: string[] = [`${title}:`]
  const keys = Object.keys(resources).sort((left, right) => {
    return left.localeCompare(right)
  })
  for (const key of keys) {
    lines.push(`  ${`${key}:`.padEnd(20)}${resources[key]}`)
  }
  return lines
}

const formatNodeSystemInfo = (node: Node): string[] => {
  const info = node.status.nodeInfo
  return [
    'System Info:',
    `  Machine ID:                 ${info.machineID ?? '<none>'}`,
    `  System UUID:                ${info.systemUUID ?? '<none>'}`,
    `  Boot ID:                    ${info.bootID ?? '<none>'}`,
    `  Kernel Version:             ${info.kernelVersion}`,
    `  OS Image:                   ${info.osImage}`,
    `  Operating System:           ${info.operatingSystem}`,
    `  Architecture:               ${info.architecture}`,
    `  Container Runtime Version:  ${info.containerRuntimeVersion}`,
    `  Kubelet Version:            ${info.kubeletVersion}`,
    `  Kube-Proxy Version:         ${info.kubeProxyVersion ?? ''}`
  ]
}

const isNonTerminatedPod = (pod: Pod): boolean => {
  return pod.status.phase !== 'Succeeded' && pod.status.phase !== 'Failed'
}

const getNonTerminatedPodsOnNode = (
  nodeName: string,
  state: ClusterStateData | undefined
): Pod[] => {
  if (state === undefined) {
    return []
  }
  return state.pods.items.filter((pod) => {
    return pod.spec.nodeName === nodeName && isNonTerminatedPod(pod)
  })
}

const parseCpuToMilli = (value: string | undefined): number => {
  if (value === undefined || value.length === 0) {
    return 0
  }
  if (value.endsWith('m')) {
    const milli = Number.parseInt(value.slice(0, -1), 10)
    return Number.isNaN(milli) ? 0 : milli
  }
  const cores = Number.parseFloat(value)
  if (Number.isNaN(cores)) {
    return 0
  }
  return Math.round(cores * 1000)
}

const parseMemoryToBytes = (value: string | undefined): number => {
  if (value === undefined || value.length === 0) {
    return 0
  }
  const normalized = value.trim()
  const binaryUnits: Record<string, number> = {
    Ki: 1024,
    Mi: 1024 ** 2,
    Gi: 1024 ** 3,
    Ti: 1024 ** 4
  }
  const unit = Object.keys(binaryUnits).find((candidate) => {
    return normalized.endsWith(candidate)
  })
  if (unit) {
    const numeric = Number.parseFloat(normalized.slice(0, -2))
    if (Number.isNaN(numeric)) {
      return 0
    }
    return Math.round(numeric * binaryUnits[unit])
  }
  const asNumber = Number.parseFloat(normalized)
  if (Number.isNaN(asNumber)) {
    return 0
  }
  return Math.round(asNumber)
}

const calculatePercent = (used: number, total: number): number => {
  if (total <= 0) {
    return 0
  }
  return Math.floor((used / total) * 100)
}

interface PodResourceTotals {
  cpuRequestsMilli: number
  cpuLimitsMilli: number
  memoryRequestsBytes: number
  memoryLimitsBytes: number
}

const formatMemoryQuantity = (bytes: number): string => {
  if (bytes <= 0) {
    return '0'
  }
  const mebibytes = Math.round(bytes / 1024 ** 2)
  return `${mebibytes}Mi`
}

const createEmptyPodResourceTotals = (): PodResourceTotals => {
  return {
    cpuRequestsMilli: 0,
    cpuLimitsMilli: 0,
    memoryRequestsBytes: 0,
    memoryLimitsBytes: 0
  }
}

const getPodResources = (pod: Pod): PodResourceTotals => {
  const totals = createEmptyPodResourceTotals()
  for (const container of pod.spec.containers) {
    totals.cpuRequestsMilli =
      totals.cpuRequestsMilli +
      parseCpuToMilli(container.resources?.requests?.cpu)
    totals.cpuLimitsMilli =
      totals.cpuLimitsMilli + parseCpuToMilli(container.resources?.limits?.cpu)
    totals.memoryRequestsBytes =
      totals.memoryRequestsBytes +
      parseMemoryToBytes(container.resources?.requests?.memory)
    totals.memoryLimitsBytes =
      totals.memoryLimitsBytes +
      parseMemoryToBytes(container.resources?.limits?.memory)
  }
  return totals
}

const addPodResourcesToTotals = (
  totals: PodResourceTotals,
  podTotals: PodResourceTotals
): void => {
  totals.cpuRequestsMilli = totals.cpuRequestsMilli + podTotals.cpuRequestsMilli
  totals.cpuLimitsMilli = totals.cpuLimitsMilli + podTotals.cpuLimitsMilli
  totals.memoryRequestsBytes =
    totals.memoryRequestsBytes + podTotals.memoryRequestsBytes
  totals.memoryLimitsBytes =
    totals.memoryLimitsBytes + podTotals.memoryLimitsBytes
}

const formatNonTerminatedPodRow = (
  pod: Pod,
  podTotals: PodResourceTotals,
  node: Node,
  namespaceColumnWidth: number,
  nameColumnWidth: number
): string => {
  const allocatableCpuMilli = parseCpuToMilli(node.status.allocatable?.cpu)
  const allocatableMemoryBytes = parseMemoryToBytes(
    node.status.allocatable?.memory
  )
  const cpuRequestsPercent = calculatePercent(
    podTotals.cpuRequestsMilli,
    allocatableCpuMilli
  )
  const cpuLimitsPercent = calculatePercent(
    podTotals.cpuLimitsMilli,
    allocatableCpuMilli
  )
  const memoryRequestsPercent = calculatePercent(
    podTotals.memoryRequestsBytes,
    allocatableMemoryBytes
  )
  const memoryLimitsPercent = calculatePercent(
    podTotals.memoryLimitsBytes,
    allocatableMemoryBytes
  )
  const cpuRequests =
    podTotals.cpuRequestsMilli === 0
      ? '0 (0%)'
      : `${podTotals.cpuRequestsMilli}m (${cpuRequestsPercent}%)`
  const cpuLimits =
    podTotals.cpuLimitsMilli === 0
      ? '0 (0%)'
      : `${podTotals.cpuLimitsMilli}m (${cpuLimitsPercent}%)`
  const memoryRequests = `${formatMemoryQuantity(podTotals.memoryRequestsBytes)} (${memoryRequestsPercent}%)`
  const memoryLimits = `${formatMemoryQuantity(podTotals.memoryLimitsBytes)} (${memoryLimitsPercent}%)`

  return `  ${pod.metadata.namespace.padEnd(namespaceColumnWidth)}${pod.metadata.name.padEnd(nameColumnWidth)}${cpuRequests.padEnd(14)}${cpuLimits.padEnd(12)}${memoryRequests.padEnd(16)}${memoryLimits.padEnd(15)}${formatAge(pod.metadata.creationTimestamp)}`
}

const formatAllocatedResourceLines = (
  node: Node,
  totals: PodResourceTotals
): string[] => {
  const allocatableCpuMilli = parseCpuToMilli(node.status.allocatable?.cpu)
  const allocatableMemoryBytes = parseMemoryToBytes(
    node.status.allocatable?.memory
  )
  const cpuRequestsPercent = calculatePercent(
    totals.cpuRequestsMilli,
    allocatableCpuMilli
  )
  const cpuLimitsPercent = calculatePercent(
    totals.cpuLimitsMilli,
    allocatableCpuMilli
  )
  const memoryRequestsPercent = calculatePercent(
    totals.memoryRequestsBytes,
    allocatableMemoryBytes
  )
  const memoryLimitsPercent = calculatePercent(
    totals.memoryLimitsBytes,
    allocatableMemoryBytes
  )

  return [
    'Allocated resources:',
    '  (Total limits may be over 100 percent, i.e., overcommitted.)',
    '  Resource           Requests    Limits',
    '  --------           --------    ------',
    `  ${'cpu'.padEnd(19)}${`${totals.cpuRequestsMilli}m (${cpuRequestsPercent}%)`.padEnd(12)}${`${totals.cpuLimitsMilli}m (${cpuLimitsPercent}%)`}`,
    `  ${'memory'.padEnd(19)}${`${formatMemoryQuantity(totals.memoryRequestsBytes)} (${memoryRequestsPercent}%)`.padEnd(12)}${`${formatMemoryQuantity(totals.memoryLimitsBytes)} (${memoryLimitsPercent}%)`}`,
    `  ${'ephemeral-storage'.padEnd(19)}${'0 (0%)'.padEnd(12)}0 (0%)`,
    `  ${'hugepages-1Gi'.padEnd(19)}${'0 (0%)'.padEnd(12)}0 (0%)`,
    `  ${'hugepages-2Mi'.padEnd(19)}${'0 (0%)'.padEnd(12)}0 (0%)`
  ]
}

const formatNodePodResources = (node: Node, pods: Pod[]): string[] => {
  const lines: string[] = []
  const namespaceColumnWidth = 28
  const minNameWidth = 20
  const maxNameLength = pods.reduce((maxLength, pod) => {
    return Math.max(maxLength, pod.metadata.name.length)
  }, 'Name'.length)
  const nameColumnWidth = Math.max(minNameWidth, maxNameLength + 4)
  lines.push(`Non-terminated Pods:          (${pods.length} in total)`)
  lines.push(
    `  ${'Namespace'.padEnd(namespaceColumnWidth)}${'Name'.padEnd(nameColumnWidth)}CPU Requests  CPU Limits  Memory Requests  Memory Limits  Age`
  )
  lines.push(
    `  ${'---------'.padEnd(namespaceColumnWidth)}${'----'.padEnd(nameColumnWidth)}------------  ----------  ---------------  -------------  ---`
  )

  const totals = createEmptyPodResourceTotals()
  for (const pod of pods) {
    const podTotals = getPodResources(pod)
    addPodResourcesToTotals(totals, podTotals)
    lines.push(
      formatNonTerminatedPodRow(
        pod,
        podTotals,
        node,
        namespaceColumnWidth,
        nameColumnWidth
      )
    )
  }
  lines.push(...formatAllocatedResourceLines(node, totals))
  return lines
}

const resolveContainerStateDetails = (
  status: ContainerStatus | undefined
): ContainerRuntimeStateDetails | undefined => {
  return status?.stateDetails
}

const resolveContainerLastStateDetails = (
  status: ContainerStatus | undefined
): ContainerRuntimeStateDetails | undefined => {
  if (status == null) {
    return undefined
  }
  return status.lastStateDetails
}

const appendContainerStateBlock = (
  lines: string[],
  label: 'State' | 'Last State',
  stateDetails: ContainerRuntimeStateDetails
): void => {
  lines.push(`    ${label}:          ${stateDetails.state}`)
  if (stateDetails.reason != null && stateDetails.reason.length > 0) {
    lines.push(`      Reason:       ${stateDetails.reason}`)
  }
  if (stateDetails.exitCode != null) {
    lines.push(`      Exit Code:    ${stateDetails.exitCode}`)
  }
  if (stateDetails.startedAt != null) {
    lines.push(
      `      Started:      ${formatDescribeDate(stateDetails.startedAt)}`
    )
  }
  if (stateDetails.finishedAt != null) {
    lines.push(
      `      Finished:     ${formatDescribeDate(stateDetails.finishedAt)}`
    )
  }
}

// ─── Container Formatter ─────────────────────────────────────────────────

/**
 * Format a single container (works for both init and regular containers)
 */
const formatContainer = (
  container: Pod['spec']['containers'][0],
  lines: string[],
  containerStatus?: ContainerStatus
): void => {
  // Container name
  lines.push(indent(`${container.name}:`, 1))

  // Container state (for init containers)
  if (containerStatus?.stateDetails?.state != null) {
    lines.push(indent(kv('State', containerStatus.stateDetails.state), 2))
  }

  lines.push(indent(kv('Image', container.image), 2))

  // Command and args
  if (container.command && container.command.length > 0) {
    lines.push(indent('Command:', 2))
    container.command.forEach((cmd) => lines.push(indent(cmd, 3)))
  }

  if (container.args && container.args.length > 0) {
    lines.push(indent('Args:', 2))
    container.args.forEach((arg) => lines.push(indent(arg, 3)))
  }

  // Ports
  if (container.ports && container.ports.length > 0) {
    const portsStr = container.ports
      .map((p) => `${p.containerPort}/${p.protocol || 'TCP'}`)
      .join(', ')
    lines.push(indent(kv('Ports', portsStr), 2))
  }

  // Resources
  if (container.resources) {
    if (container.resources.requests) {
      const requests = container.resources.requests
      const requestParts: string[] = []
      if (requests.cpu) {
        requestParts.push(`cpu: ${requests.cpu}`)
      }
      if (requests.memory) {
        requestParts.push(`memory: ${requests.memory}`)
      }
      if (requestParts.length > 0) {
        lines.push(indent('Requests:', 2))
        requestParts.forEach((part) => lines.push(indent(part, 3)))
      }
    }
    if (container.resources.limits) {
      const limits = container.resources.limits
      const limitParts: string[] = []
      if (limits.cpu) {
        limitParts.push(`cpu: ${limits.cpu}`)
      }
      if (limits.memory) {
        limitParts.push(`memory: ${limits.memory}`)
      }
      if (limitParts.length > 0) {
        lines.push(indent('Limits:', 2))
        limitParts.forEach((part) => lines.push(indent(part, 3)))
      }
    }
  }

  // Probes
  if (container.livenessProbe) {
    lines.push(indent('Liveness:', 2))
    formatProbe(container.livenessProbe).forEach((line) =>
      lines.push(indent(line, 2))
    )
  }

  if (container.readinessProbe) {
    lines.push(indent('Readiness:', 2))
    formatProbe(container.readinessProbe).forEach((line) =>
      lines.push(indent(line, 2))
    )
  }

  if (container.startupProbe) {
    lines.push(indent('Startup:', 2))
    formatProbe(container.startupProbe).forEach((line) =>
      lines.push(indent(line, 2))
    )
  }

  // Environment variables
  if (container.env && container.env.length > 0) {
    lines.push(indent('Environment:', 2))
    container.env.forEach((envVar) => {
      lines.push(indent(formatEnvVar(envVar), 2))
    })
  }

  // Volume mounts
  if (container.volumeMounts && container.volumeMounts.length > 0) {
    lines.push(indent('Mounts:', 2))
    container.volumeMounts.forEach((mount) => {
      lines.push(indent(formatVolumeMount(mount), 2))
    })
  } else {
    lines.push(indent('Mounts:           <none>', 2))
  }
}

// ─── Main Formatters ─────────────────────────────────────────────────────

const formatPodConditionLines = (pod: Pod): string[] => {
  const lines: string[] = [
    'Conditions:',
    '  Type                        Status'
  ]
  const conditions = pod.status.conditions ?? []
  const hasReadyToStart = conditions.some((condition) => {
    return condition.type === 'PodReadyToStartContainers'
  })
  if (!hasReadyToStart) {
    const status = pod.status.phase === 'Running' ? 'True' : 'False'
    lines.push(`  ${'PodReadyToStartContainers'.padEnd(28)}${status} `)
  }
  for (const condition of conditions) {
    lines.push(`  ${condition.type.padEnd(28)}${condition.status} `)
  }
  return lines
}

const formatPodTolerations = (tolerations?: PodToleration[]): string[] => {
  if (tolerations == null || tolerations.length === 0) {
    return ['Tolerations:       <none>']
  }
  const lines: string[] = []
  tolerations.forEach((toleration, index) => {
    const key = toleration.key ?? ''
    const value = toleration.value != null ? `=${toleration.value}` : ''
    const effect = toleration.effect ?? '<none>'
    const operator = toleration.operator ?? 'Equal'
    const rendered = `${key}${value}:${effect} op=${operator}`
    if (index === 0) {
      lines.push(`Tolerations:       ${rendered}`)
      return
    }
    lines.push(`                   ${rendered}`)
  })
  return lines
}

const formatDefaultPodEvents = (pod: Pod, nodeName: string): string[] => {
  const age = formatAge(pod.metadata.creationTimestamp)
  const primaryContainer = pod.spec.containers[0]
  const containerName = primaryContainer?.name ?? 'container'
  const containerImage = primaryContainer?.image ?? '<unknown>'
  return [
    'Events:',
    '  Type    Reason     Age   From               Message',
    '  ----    ------     ----  ----               -------',
    `  Normal  Scheduled  ${age}    default-scheduler  Successfully assigned ${pod.metadata.namespace}/${pod.metadata.name} to ${nodeName}`,
    `  Normal  Pulled     ${age}    kubelet            spec.containers{${containerName}}: Container image "${containerImage}" already present on machine and can be accessed by the pod`,
    `  Normal  Created    ${age}    kubelet            spec.containers{${containerName}}: Container created`,
    `  Normal  Started    ${age}    kubelet            spec.containers{${containerName}}: Container started`
  ]
}

const getPrimaryContainerStatus = (pod: Pod): ContainerStatus | undefined => {
  const primaryContainer = pod.spec.containers[0]
  if (primaryContainer == null) {
    return undefined
  }
  return (pod.status.containerStatuses ?? []).find((status) => {
    return status.name === primaryContainer.name
  })
}

const formatPodLifecycleWarningEvents = (
  pod: Pod,
  status: ContainerStatus | undefined,
  age: string
): string[] => {
  const lines: string[] = []
  const primaryContainer = pod.spec.containers[0]
  const containerName = primaryContainer?.name ?? 'container'
  const containerImage = primaryContainer?.image ?? '<unknown>'
  const reason = status?.stateDetails?.reason
  if (reason == null) {
    return lines
  }
  if (reason === 'ErrImagePull') {
    lines.push(
      `  Warning Failed     ${age}    kubelet            Failed to pull image "${containerImage}": image not found`
    )
    return lines
  }
  if (reason === 'ImagePullBackOff') {
    lines.push(
      `  Warning BackOff    ${age}    kubelet            Back-off pulling image "${containerImage}"`
    )
    return lines
  }
  if (reason === 'CrashLoopBackOff') {
    lines.push(
      `  Warning BackOff    ${age}    kubelet            Back-off restarting failed container ${containerName} in pod ${pod.metadata.namespace}/${pod.metadata.name}`
    )
    return lines
  }
  if (
    reason === 'VolumesNotReady' ||
    reason === 'WaitingForPVC' ||
    reason === 'PersistentVolumeClaimPending' ||
    reason === 'PersistentVolumeClaimNotFound'
  ) {
    lines.push(
      `  Warning FailedMount ${age}   kubelet            Unable to attach or mount volumes: timed out waiting for condition`
    )
    return lines
  }
  return lines
}

const formatPodEvents = (pod: Pod, nodeName: string): string[] => {
  const age = formatAge(pod.metadata.creationTimestamp)
  const primaryStatus = getPrimaryContainerStatus(pod)
  const warnings = formatPodLifecycleWarningEvents(pod, primaryStatus, age)
  if (pod.status.phase !== 'Running') {
    if (warnings.length === 0) {
      return ['Events:            <none>']
    }
    return [
      'Events:',
      '  Type    Reason      Age   From               Message',
      '  ----    ------      ----  ----               -------',
      ...warnings
    ]
  }
  return [...formatDefaultPodEvents(pod, nodeName), ...warnings]
}

const formatStoredPodEvents = (
  events: readonly PodLifecycleDescribeEvent[]
): string[] => {
  if (events.length === 0) {
    return ['Events:            <none>']
  }
  const parseTimestamp = (value: string): number => {
    const parsed = Date.parse(value)
    if (Number.isNaN(parsed)) {
      return 0
    }
    return parsed
  }
  const aggregatedByKey = new Map<
    string,
    {
      type: PodLifecycleDescribeEvent['type']
      reason: string
      source: string
      message: string
      firstTimestamp: string
      lastTimestamp: string
      count: number
      firstSeenAtMs: number
    }
  >()
  for (const event of events) {
    const key = [event.type, event.reason, event.source, event.message].join(
      '|'
    )
    const eventTs = parseTimestamp(event.timestamp)
    const existing = aggregatedByKey.get(key)
    if (existing == null) {
      aggregatedByKey.set(key, {
        type: event.type,
        reason: event.reason,
        source: event.source,
        message: event.message,
        firstTimestamp: event.timestamp,
        lastTimestamp: event.timestamp,
        count: 1,
        firstSeenAtMs: eventTs
      })
      continue
    }
    if (eventTs >= parseTimestamp(existing.lastTimestamp)) {
      existing.lastTimestamp = event.timestamp
    }
    if (eventTs < existing.firstSeenAtMs) {
      existing.firstSeenAtMs = eventTs
      existing.firstTimestamp = event.timestamp
    }
    existing.count += 1
  }
  const aggregatedEvents = Array.from(aggregatedByKey.values()).sort(
    (left, right) => {
      return left.firstSeenAtMs - right.firstSeenAtMs
    }
  )
  const maxReasonLength = aggregatedEvents.reduce((currentMax, event) => {
    return Math.max(currentMax, event.reason.length)
  }, 6)
  const maxCountLength = aggregatedEvents.reduce((currentMax, event) => {
    return Math.max(currentMax, String(event.count).length)
  }, 5)
  const lines: string[] = [
    'Events:',
    '  Type    Reason      First Seen  Last Seen   Count   From               Message',
    '  ----    ------      ----------  ---------   -----   ----               -------'
  ]
  for (const event of aggregatedEvents) {
    const firstSeen = formatAge(event.firstTimestamp)
    const lastSeen = formatAge(event.lastTimestamp)
    const reason = event.reason.padEnd(maxReasonLength)
    const count = String(event.count).padEnd(maxCountLength)
    const source = event.source.padEnd(18)
    lines.push(
      `  ${event.type.padEnd(7)} ${reason}  ${firstSeen.padEnd(10)}  ${lastSeen.padEnd(9)}   ${count}   ${source} ${event.message}`
    )
  }
  return lines
}

const formatStaticControlPlaneHeader = (
  pod: Pod
): {
  priority: string
  priorityClassName?: string
  seccompProfile?: string
  controlledBy?: string
} => {
  const labels = pod.metadata.labels ?? {}
  const isControlPlaneStaticPod =
    labels['tier'] === 'control-plane' &&
    (labels['component'] === 'kube-apiserver' ||
      labels['component'] === 'kube-controller-manager' ||
      labels['component'] === 'kube-scheduler' ||
      labels['component'] === 'etcd')
  if (!isControlPlaneStaticPod) {
    return {
      priority: '0'
    }
  }
  return {
    priority: '2000001000',
    priorityClassName: 'system-node-critical',
    seccompProfile: 'RuntimeDefault',
    controlledBy:
      pod.spec.nodeName != null ? `Node/${pod.spec.nodeName}` : undefined
  }
}

const formatProbeInline = (
  title: string,
  probe: Probe,
  podIP: string,
  failure: number
): string => {
  const titleLabel = `${title}:`.padEnd(14)
  if (probe.type === 'httpGet') {
    const delay = probe.initialDelaySeconds ?? 0
    const period = probe.periodSeconds ?? 10
    return `    ${titleLabel}http-get https://${podIP}:probe-port${probe.path} delay=${delay}s timeout=15s period=${period}s #success=1 #failure=${failure}`
  }
  if (probe.type === 'tcpSocket') {
    return `    ${titleLabel}tcp-socket :${probe.port}`
  }
  if (probe.type === 'exec') {
    return `    ${titleLabel}exec [${probe.command.join(' ')}]`
  }
  return `    ${titleLabel}<unknown>`
}

/**
 * Format detailed pod description
 */
export const describePod = (
  pod: Pod,
  podLifecycleEvents?: readonly PodLifecycleDescribeEvent[]
): string => {
  const lines: string[] = []
  const podIP = pod.status.podIP ?? simulatePodIP(pod.metadata.name)
  const nodeName = pod.spec.nodeName ?? '<none>'
  const nodeIP = simulatePodIP(nodeName)
  const header = formatStaticControlPlaneHeader(pod)
  const isStaticControlPlanePod = header.priorityClassName != null
  const hasNodeAssignment =
    pod.spec.nodeName != null && pod.spec.nodeName.length > 0
  const kubeApiAccessVolumeName = buildKubeApiAccessVolumeName(pod)

  // Basic metadata
  lines.push(`Name:                 ${pod.metadata.name}`)
  lines.push(`Namespace:            ${pod.metadata.namespace}`)
  lines.push(`Priority:             ${header.priority}`)
  if (header.priorityClassName != null) {
    lines.push(`Priority Class Name:  ${header.priorityClassName}`)
  }
  if (header.priorityClassName == null) {
    lines.push('Service Account:      default')
  }
  lines.push(`Node:                 ${nodeName}/${nodeIP}`)
  lines.push(
    `Start Time:           ${formatDescribeDate(pod.metadata.creationTimestamp)}`
  )
  lines.push(...formatMapMultiLine('Labels', pod.metadata.labels))
  lines.push(
    ...formatMapMultiLine(
      'Annotations',
      sanitizeDescribeAnnotations(pod.metadata.annotations),
      'colon'
    )
  )
  lines.push(`Status:               ${getDescribePodStatus(pod)}`)
  if (header.seccompProfile != null) {
    lines.push(`SeccompProfile:       ${header.seccompProfile}`)
  }
  lines.push(`IP:                   ${podIP}`)
  lines.push('IPs:')
  lines.push(`  IP:           ${podIP}`)
  if (header.controlledBy != null) {
    lines.push(`Controlled By:  ${header.controlledBy}`)
  }

  // Init Containers section (if any)
  if (pod.spec.initContainers && pod.spec.initContainers.length > 0) {
    const initContainerLines: string[] = []
    for (const initContainer of pod.spec.initContainers) {
      const status = pod.status.containerStatuses?.find(
        (cs) => cs.name === initContainer.name
      )
      formatContainer(initContainer, initContainerLines, status)
    }
    lines.push(...section('Init Containers', initContainerLines))
    lines.push(blank())
  }

  // Containers section
  lines.push('Containers:')
  for (const container of pod.spec.containers) {
    const status = pod.status.containerStatuses?.find(
      (cs) => cs.name === container.name
    )
    lines.push(`  ${container.name}:`)
    lines.push(`    Container ID:  ${status?.containerID ?? '<none>'}`)
    lines.push(`    Image:         ${container.image}`)
    // Image ID: full path with digest (e.g. docker.io/library/busybox@sha256:...), like kind/kubectl
    const imageId = status?.imageID ?? '<none>'
    lines.push(`    Image ID:      ${imageId}`)
    if (container.ports != null && container.ports.length > 0) {
      const firstPort = container.ports[0]
      if (isStaticControlPlanePod) {
        lines.push(
          `    Port:          ${firstPort.containerPort}/${firstPort.protocol ?? 'TCP'} (probe-port)`
        )
        lines.push(
          `    Host Port:     ${firstPort.containerPort}/${firstPort.protocol ?? 'TCP'} (probe-port)`
        )
      } else {
        lines.push(
          `    Port:          ${firstPort.containerPort}/${firstPort.protocol ?? 'TCP'}`
        )
        lines.push(`    Host Port:     0/${firstPort.protocol ?? 'TCP'}`)
      }
    }
    if (container.command && container.command.length > 0) {
      lines.push('    Command:')
      container.command.forEach((commandPart) => {
        lines.push(`      ${commandPart}`)
      })
    }
    if (container.args && container.args.length > 0) {
      container.args.forEach((arg) => {
        lines.push(`      ${arg}`)
      })
    }
    const currentStateDetails =
      resolveContainerStateDetails(status) ??
      ({
        state: pod.status.phase === 'Running' ? 'Running' : 'Waiting'
      } as ContainerRuntimeStateDetails)
    appendContainerStateBlock(lines, 'State', currentStateDetails)
    const lastStateDetails = resolveContainerLastStateDetails(status)
    if (lastStateDetails != null) {
      appendContainerStateBlock(lines, 'Last State', lastStateDetails)
    }
    lines.push(
      `    Ready:          ${status?.ready === true ? 'True' : 'False'}`
    )
    lines.push(`    Restart Count:  ${status?.restartCount ?? 0}`)
    if (container.resources?.requests != null) {
      const entries = Object.entries(container.resources.requests)
      if (entries.length > 0) {
        lines.push('    Requests:')
        entries.forEach(([key, value]) => {
          lines.push(`      ${key}:        ${value}`)
        })
      }
    }
    if (container.resources?.limits != null) {
      const entries = Object.entries(container.resources.limits)
      if (entries.length > 0) {
        lines.push('    Limits:')
        entries.forEach(([key, value]) => {
          lines.push(`      ${key}:        ${value}`)
        })
      }
    }
    if (container.livenessProbe != null) {
      lines.push(
        formatProbeInline('Liveness', container.livenessProbe, podIP, 8)
      )
    }
    if (container.readinessProbe != null) {
      lines.push(
        formatProbeInline('Readiness', container.readinessProbe, podIP, 3)
      )
    }
    if (container.startupProbe != null) {
      lines.push(
        formatProbeInline('Startup', container.startupProbe, podIP, 24)
      )
    }
    if (container.env != null && container.env.length > 0) {
      lines.push('    Environment:  ')
      container.env.forEach((envVar) => {
        lines.push(`      ${formatEnvVar(envVar).trim()}`)
      })
    } else {
      lines.push('    Environment:  <none>')
    }
    if (container.volumeMounts != null && container.volumeMounts.length > 0) {
      lines.push('    Mounts:')
      container.volumeMounts.forEach((mount) => {
        lines.push(
          `      ${mount.mountPath} from ${mount.name} (${mount.readOnly === true ? 'ro' : 'rw'})`
        )
      })
    } else if (isStaticControlPlanePod === false && hasNodeAssignment) {
      lines.push('    Mounts:')
      lines.push(
        `      /var/run/secrets/kubernetes.io/serviceaccount from ${kubeApiAccessVolumeName} (ro)`
      )
    }
  }

  // Volumes section
  if (pod.spec.volumes && pod.spec.volumes.length > 0) {
    lines.push('Volumes:')
    pod.spec.volumes.forEach((volume) => {
      lines.push(`  ${volume.name}:`)
      lines.push(formatVolumeSource(volume))
    })
  } else if (isStaticControlPlanePod === false && hasNodeAssignment) {
    lines.push('Volumes:')
    lines.push(`  ${kubeApiAccessVolumeName}:`)
    lines.push(
      '    Type:                    Projected (a volume that contains injected data from multiple sources)'
    )
    lines.push('    TokenExpirationSeconds:  3607')
    lines.push('    ConfigMapName:           kube-root-ca.crt')
    lines.push('    Optional:                false')
    lines.push('    DownwardAPI:             true')
  } else {
    lines.push('Volumes:  <none>')
  }
  lines.push(...formatPodConditionLines(pod))
  lines.push(`QoS Class:         ${pod.status.qosClass ?? 'BestEffort'}`)
  lines.push(`Node-Selectors:    ${formatLabels(pod.spec.nodeSelector)}`)
  const effectiveTolerations =
    pod.spec.tolerations ??
    (isStaticControlPlanePod
      ? undefined
      : hasNodeAssignment
        ? [
            {
              key: 'node.kubernetes.io/not-ready',
              operator: 'Exists',
              effect: 'NoExecute',
              tolerationSeconds: 300
            },
            {
              key: 'node.kubernetes.io/unreachable',
              operator: 'Exists',
              effect: 'NoExecute',
              tolerationSeconds: 300
            }
          ]
        : undefined)
  lines.push(...formatPodTolerations(effectiveTolerations))
  if (isStaticControlPlanePod === false && hasNodeAssignment) {
    if (podLifecycleEvents != null && podLifecycleEvents.length > 0) {
      lines.push(...formatStoredPodEvents(podLifecycleEvents))
    } else {
      lines.push(...formatPodEvents(pod, nodeName))
    }
  } else {
    lines.push('Events:            <none>')
  }

  return lines.join('\n')
}

export const describeNode = (node: Node, state?: ClusterStateData): string => {
  const lines: string[] = []
  lines.push(`Name:               ${node.metadata.name}`)
  lines.push(`Roles:              ${getNodeRoles(node)}`)
  lines.push(...formatMapMultiLine('Labels', node.metadata.labels))
  lines.push(
    ...formatMapMultiLine('Annotations', node.metadata.annotations, 'colon')
  )
  lines.push(
    `CreationTimestamp:  ${formatDescribeDate(node.metadata.creationTimestamp)}`
  )
  lines.push(`Taints:             ${formatNodeTaints(node.spec.taints)}`)
  lines.push(
    `Unschedulable:      ${node.spec.unschedulable === true ? 'true' : 'false'}`
  )
  lines.push('Lease:')
  lines.push(`  HolderIdentity:  ${node.metadata.name}`)
  lines.push('  AcquireTime:     <unset>')
  lines.push(
    `  RenewTime:       ${formatDescribeDate(node.metadata.creationTimestamp)}`
  )
  lines.push(...formatNodeConditions(node.status.conditions))
  lines.push(...formatNodeAddresses(node.status.addresses))
  lines.push(...formatNodeResourceList('Capacity', node.status.capacity))
  lines.push(...formatNodeResourceList('Allocatable', node.status.allocatable))
  lines.push(...formatNodeSystemInfo(node))
  if (node.spec.podCIDR && node.spec.podCIDR.length > 0) {
    lines.push(`PodCIDR:                      ${node.spec.podCIDR}`)
  }
  if (node.spec.podCIDRs && node.spec.podCIDRs.length > 0) {
    lines.push(`PodCIDRs:                     ${node.spec.podCIDRs.join(',')}`)
  }
  if (node.spec.providerID && node.spec.providerID.length > 0) {
    lines.push(`ProviderID:                   ${node.spec.providerID}`)
  }
  const pods = getNonTerminatedPodsOnNode(node.metadata.name, state)
  lines.push(...formatNodePodResources(node, pods))
  lines.push('Events:              <none>')
  return lines.join('\n')
}

/**
 * Format detailed Deployment description
 */
export const describeDeployment = (deployment: Deployment): string => {
  const lines: string[] = []
  const strategyType = formatStrategyType(deployment.spec.strategy?.type)

  lines.push(`Name:             ${deployment.metadata.name}`)
  lines.push(`Namespace:        ${deployment.metadata.namespace}`)
  lines.push(
    `CreationTimestamp: ${formatDescribeDate(deployment.metadata.creationTimestamp)}`
  )
  lines.push(`Labels:           ${formatLabels(deployment.metadata.labels)}`)
  lines.push(
    `Annotations:      ${formatLabels(deployment.metadata.annotations)}`
  )
  lines.push(`Selector:         ${formatSelector(deployment.spec.selector)}`)
  lines.push(`Replicas:         ${formatDeploymentReplicas(deployment)}`)
  lines.push(`StrategyType:     ${strategyType}`)
  lines.push(`MinReadySeconds:  ${deployment.spec.minReadySeconds ?? 0}`)
  if (strategyType === 'RollingUpdate') {
    const rollingUpdate = deployment.spec.strategy?.rollingUpdate
    lines.push(
      `RollingUpdateStrategy: ${formatIntOrString(rollingUpdate?.maxUnavailable)} max unavailable, ${formatIntOrString(rollingUpdate?.maxSurge)} max surge`
    )
  }

  lines.push(blank())

  const templateLines: string[] = []
  templateLines.push(
    kv('Labels', formatLabels(deployment.spec.template.metadata?.labels))
  )
  templateLines.push(
    kv(
      'Annotations',
      formatLabels(deployment.spec.template.metadata?.annotations)
    )
  )
  templateLines.push(
    kv(
      'Node-Selectors',
      formatLabels(deployment.spec.template.spec.nodeSelector)
    )
  )

  const tolerations = deployment.spec.template.spec.tolerations
  if (tolerations && tolerations.length > 0) {
    const tolerationParts = tolerations.map((toleration) => {
      const key = toleration.key ?? '<none>'
      const operator = toleration.operator ?? 'Equal'
      const value = toleration.value ?? '<none>'
      const effect = toleration.effect ?? '<none>'
      return `${key}:${operator}:${value}:${effect}`
    })
    templateLines.push(kv('Tolerations', tolerationParts.join(', ')))
  } else {
    templateLines.push(kv('Tolerations', '<none>'))
  }

  const initContainers = deployment.spec.template.spec.initContainers
  if (initContainers && initContainers.length > 0) {
    templateLines.push('Init Containers:')
    for (const container of initContainers) {
      templateLines.push(indent(`${container.name}:`, 1))
      templateLines.push(indent(kv('Image', container.image), 2))
    }
  }

  templateLines.push('Containers:')
  for (const container of deployment.spec.template.spec.containers) {
    templateLines.push(indent(`${container.name}:`, 1))
    templateLines.push(indent(kv('Image', container.image), 2))

    if (container.command && container.command.length > 0) {
      templateLines.push(indent('Command:', 2))
      for (const cmd of container.command) {
        templateLines.push(indent(cmd, 3))
      }
    }

    if (container.args && container.args.length > 0) {
      templateLines.push(indent('Args:', 2))
      for (const arg of container.args) {
        templateLines.push(indent(arg, 3))
      }
    }

    if (container.ports && container.ports.length > 0) {
      const ports = container.ports
        .map((port) => `${port.containerPort}/${port.protocol ?? 'TCP'}`)
        .join(', ')
      templateLines.push(indent(kv('Ports', ports), 2))
    }

    if (container.env && container.env.length > 0) {
      templateLines.push(indent('Environment:', 2))
      for (const envVar of container.env) {
        formatTemplateEnv(envVar, templateLines)
      }
    }
  }

  lines.push(...section('Pod Template', templateLines))
  lines.push(blank())
  lines.push(...formatDeploymentConditions(deployment.status.conditions))
  lines.push(blank())
  lines.push('Events:             <none>')

  return lines.join('\n')
}

export const describeReplicaSet = (
  replicaSet: ReplicaSet,
  state?: ClusterStateData
): string => {
  const hasReplicaSetOwnerReference = (pod: Pod): boolean => {
    const ownerReferences = pod.metadata.ownerReferences ?? []
    return ownerReferences.some((ownerReference) => {
      return (
        ownerReference.kind === 'ReplicaSet' &&
        ownerReference.name === replicaSet.metadata.name
      )
    })
  }
  const getManagedPods = (): Pod[] => {
    if (state == null) {
      return []
    }
    const selectorMatchedPods = state.pods.items.filter((pod) => {
      if (pod.metadata.namespace !== replicaSet.metadata.namespace) {
        return false
      }
      return selectorMatchesLabels(
        replicaSet.spec.selector,
        pod.metadata.labels ?? {}
      )
    })
    const ownerMatchedPods = selectorMatchedPods.filter((pod) => {
      return hasReplicaSetOwnerReference(pod)
    })
    if (ownerMatchedPods.length > 0) {
      return ownerMatchedPods
    }
    return selectorMatchedPods
  }
  const managedPods = getManagedPods()
  const getPodsStatusLine = (): string => {
    const counts = {
      running: 0,
      waiting: 0,
      succeeded: 0,
      failed: 0
    }
    for (const pod of managedPods) {
      if (pod.status.phase === 'Running') {
        counts.running += 1
      } else if (pod.status.phase === 'Succeeded') {
        counts.succeeded += 1
      } else if (pod.status.phase === 'Failed') {
        counts.failed += 1
      } else {
        counts.waiting += 1
      }
    }
    return `${counts.running} Running / ${counts.waiting} Waiting / ${counts.succeeded} Succeeded / ${counts.failed} Failed`
  }
  const buildReplicaSetEventLines = (): string[] => {
    if (managedPods.length === 0) {
      return ['Events:            <none>']
    }
    const lines: string[] = [
      'Events:',
      '  Type    Reason            Age   From                   Message',
      '  ----    ------            ----  ----                   -------'
    ]
    const sortedPods = [...managedPods].sort((left, right) => {
      return (
        Date.parse(left.metadata.creationTimestamp) -
        Date.parse(right.metadata.creationTimestamp)
      )
    })
    for (const pod of sortedPods) {
      lines.push(
        `  Normal  SuccessfulCreate  ${formatAge(pod.metadata.creationTimestamp)}    replicaset-controller  Created pod: ${pod.metadata.name}`
      )
    }
    return lines
  }
  const renderContainerEnvironment = (
    container: ReplicaSet['spec']['template']['spec']['containers'][number]
  ): string[] => {
    if (container.env == null || container.env.length === 0) {
      return ['    Environment:   <none>']
    }
    const lines: string[] = ['    Environment:']
    for (const envVar of container.env) {
      if (envVar.source.type === 'value') {
        lines.push(`      ${envVar.name}:  ${envVar.source.value}`)
      } else if (envVar.source.type === 'configMapKeyRef') {
        lines.push(
          `      ${envVar.name}:  <set to the key '${envVar.source.key}' in config map '${envVar.source.name}'>`
        )
      } else {
        lines.push(
          `      ${envVar.name}:  <set to the key '${envVar.source.key}' of secret '${envVar.source.name}'>`
        )
      }
    }
    return lines
  }
  const renderContainerMounts = (
    container: ReplicaSet['spec']['template']['spec']['containers'][number]
  ): string[] => {
    if (container.volumeMounts == null || container.volumeMounts.length === 0) {
      return ['    Mounts:        <none>']
    }
    const lines: string[] = ['    Mounts:']
    for (const volumeMount of container.volumeMounts) {
      lines.push(
        `      ${volumeMount.mountPath} from ${volumeMount.name} (${volumeMount.readOnly === true ? 'ro' : 'rw'})`
      )
    }
    return lines
  }
  const renderTemplateVolumes = (): string[] => {
    const volumes = replicaSet.spec.template.spec.volumes
    if (volumes == null || volumes.length === 0) {
      return ['  Volumes:         <none>']
    }
    const lines: string[] = ['  Volumes:']
    for (const volume of volumes) {
      lines.push(`   ${volume.name}:`)
      lines.push(`    Type:          ${volume.source.type}`)
    }
    return lines
  }
  const renderTemplateTolerations = (): string => {
    const tolerations = replicaSet.spec.template.spec.tolerations
    if (tolerations == null || tolerations.length === 0) {
      return '  Tolerations:     <none>'
    }
    const firstToleration = tolerations[0]
    const firstKey = firstToleration.key ?? '<none>'
    const firstOperator = firstToleration.operator ?? 'Equal'
    const firstValue = firstToleration.value ?? '<none>'
    const firstEffect = firstToleration.effect ?? '<none>'
    const firstRendered =
      `${firstKey}:${firstOperator}:${firstValue}:${firstEffect}`
    return `  Tolerations:     ${firstRendered}`
  }
  const lines: string[] = []
  const desiredReplicas = replicaSet.spec.replicas ?? 1
  const statusReplicas = replicaSet.status.replicas ?? 0
  const currentReplicas =
    statusReplicas > 0 ? statusReplicas : managedPods.length

  lines.push(`Name:         ${replicaSet.metadata.name}`)
  lines.push(`Namespace:    ${replicaSet.metadata.namespace}`)
  lines.push(`Selector:     ${formatSelector(replicaSet.spec.selector)}`)
  lines.push(`Labels:       ${formatLabels(replicaSet.metadata.labels)}`)
  lines.push(
    `Annotations:  ${formatLabels(replicaSet.metadata.annotations)}`
  )
  lines.push(`Replicas:     ${currentReplicas} current / ${desiredReplicas} desired`)
  lines.push(`Pods Status:  ${getPodsStatusLine()}`)

  lines.push('Pod Template:')
  lines.push(`  Labels:  ${formatLabels(replicaSet.spec.template.metadata?.labels)}`)
  lines.push(
    `  Annotations:  ${formatLabels(replicaSet.spec.template.metadata?.annotations)}`
  )
  lines.push('  Containers:')
  for (const container of replicaSet.spec.template.spec.containers) {
    lines.push(`   ${container.name}:`)
    lines.push(`    Image:         ${container.image}`)
    if (container.command != null && container.command.length > 0) {
      lines.push(`    Command:       ${container.command.join(' ')}`)
    }
    if (container.args != null && container.args.length > 0) {
      lines.push(`    Args:          ${container.args.join(' ')}`)
    }
    if (container.ports != null && container.ports.length > 0) {
      const firstPort = container.ports[0]
      lines.push(
        `    Port:          ${firstPort.containerPort}/${firstPort.protocol ?? 'TCP'}`
      )
      lines.push(`    Host Port:     0/${firstPort.protocol ?? 'TCP'}`)
    } else {
      lines.push('    Port:          <none>')
      lines.push('    Host Port:     <none>')
    }
    lines.push(...renderContainerEnvironment(container))
    lines.push(...renderContainerMounts(container))
  }
  lines.push(...renderTemplateVolumes())
  lines.push(
    `  Node-Selectors:  ${formatLabels(replicaSet.spec.template.spec.nodeSelector)}`
  )
  lines.push(renderTemplateTolerations())
  lines.push(...buildReplicaSetEventLines())

  return lines.join('\n')
}

/**
 * Format detailed ConfigMap description
 */
export const describeConfigMap = (configMap: ConfigMap): string => {
  const lines: string[] = []

  // Basic metadata
  lines.push(`Name:         ${configMap.metadata.name}`)
  lines.push(`Namespace:    ${configMap.metadata.namespace}`)
  lines.push(`Labels:       ${formatLabels(configMap.metadata.labels)}`)
  lines.push(`Annotations:  ${formatLabels(configMap.metadata.annotations)}`)
  lines.push(blank())

  // Data section
  const dataCount = configMap.data ? Object.keys(configMap.data).length : 0
  const binaryDataCount = configMap.binaryData
    ? Object.keys(configMap.binaryData).length
    : 0

  lines.push('Data')
  lines.push('====')

  if (configMap.data && dataCount > 0) {
    Object.entries(configMap.data).forEach(([key, value]) => {
      lines.push(`${key}:`)
      lines.push('----')
      lines.push(value)
      lines.push('')
    })
  }

  if (configMap.binaryData && binaryDataCount > 0) {
    lines.push('')
    lines.push('BinaryData')
    lines.push('====')
    Object.entries(configMap.binaryData).forEach(([key, value]) => {
      const byteCount = value.length
      lines.push(`${key}: ${byteCount} bytes`)
    })
  }

  if (dataCount === 0 && binaryDataCount === 0) {
    lines.push('<no data>')
  }

  lines.push('')
  lines.push('Events:  <none>')

  return lines.join('\n')
}

/**
 * Format detailed Secret description
 */
export const describeSecret = (secret: Secret): string => {
  const lines: string[] = []

  // Basic metadata
  lines.push(`Name:         ${secret.metadata.name}`)
  lines.push(`Namespace:    ${secret.metadata.namespace}`)
  lines.push(`Labels:       ${formatLabels(secret.metadata.labels)}`)
  lines.push(`Annotations:  ${formatLabels(secret.metadata.annotations)}`)
  lines.push(blank())

  // Type (special format: "Type:  value" with 2 spaces)
  lines.push(`Type:  ${formatSecretType(secret.type)}`)
  lines.push(blank())

  // Data section (masked)
  lines.push('Data')
  lines.push('====')

  const dataKeys = Object.keys(secret.data)
  if (dataKeys.length > 0) {
    dataKeys.forEach((key) => {
      const value = secret.data[key]
      const byteCount = value.length
      lines.push(`${key}:  ${byteCount} bytes`)
    })
  } else {
    lines.push('<no data>')
  }

  lines.push('')
  lines.push('Events:  <none>')

  return lines.join('\n')
}

export const describePersistentVolume = (
  persistentVolume: PersistentVolume
): string => {
  const lines: string[] = []
  lines.push(`Name:            ${persistentVolume.metadata.name}`)
  lines.push(
    `Labels:          ${formatLabels(persistentVolume.metadata.labels)}`
  )
  lines.push(
    `Annotations:     ${formatLabels(persistentVolume.metadata.annotations)}`
  )
  lines.push(
    `StorageClass:    ${persistentVolume.spec.storageClassName ?? '<none>'}`
  )
  lines.push(
    `Status:          ${persistentVolume.status.phase ?? (persistentVolume.spec.claimRef == null ? 'Available' : 'Bound')}`
  )
  lines.push(
    `Claim:           ${persistentVolume.spec.claimRef != null ? `${persistentVolume.spec.claimRef.namespace}/${persistentVolume.spec.claimRef.name}` : '<none>'}`
  )
  lines.push(
    `Reclaim Policy:  ${persistentVolume.spec.persistentVolumeReclaimPolicy ?? 'Retain'}`
  )
  lines.push(`Access Modes:    ${persistentVolume.spec.accessModes.join(',')}`)
  lines.push(`Capacity:        ${persistentVolume.spec.capacity.storage}`)
  if (persistentVolume.spec.hostPath != null) {
    lines.push(
      `Source:          HostPath (${persistentVolume.spec.hostPath.path})`
    )
  } else {
    lines.push('Source:          <none>')
  }
  lines.push('')
  lines.push('Events:          <none>')
  return lines.join('\n')
}

export const describePersistentVolumeClaim = (
  persistentVolumeClaim: PersistentVolumeClaim
): string => {
  const lines: string[] = []
  lines.push(`Name:          ${persistentVolumeClaim.metadata.name}`)
  lines.push(`Namespace:     ${persistentVolumeClaim.metadata.namespace}`)
  lines.push(
    `StorageClass:  ${persistentVolumeClaim.spec.storageClassName ?? '<none>'}`
  )
  lines.push(`Status:        ${persistentVolumeClaim.status.phase}`)
  lines.push(
    `Volume:        ${persistentVolumeClaim.spec.volumeName ?? '<none>'}`
  )
  lines.push(
    `Labels:        ${formatLabels(persistentVolumeClaim.metadata.labels)}`
  )
  lines.push(
    `Annotations:   ${formatLabels(persistentVolumeClaim.metadata.annotations)}`
  )
  lines.push(
    `Capacity:      ${persistentVolumeClaim.spec.resources.requests.storage}`
  )
  lines.push(
    `Access Modes:  ${persistentVolumeClaim.spec.accessModes.join(',')}`
  )
  lines.push('')
  lines.push('Events:        <none>')
  return lines.join('\n')
}

const renderServicePort = (service: Service, portIndex: number): string => {
  const port = service.spec.ports[portIndex]
  if (port == null) {
    return '<none>'
  }
  const portName = port.name ?? '<unset>'
  return `${portName}  ${port.port}/${port.protocol}`
}

const renderServiceTargetPort = (
  service: Service,
  portIndex: number
): string => {
  const port = service.spec.ports[portIndex]
  if (port == null) {
    return '<none>'
  }
  const targetPort = port.targetPort ?? port.port
  return `${String(targetPort)}/${port.protocol}`
}

const renderServiceEndpoints = (
  service: Service,
  state: ClusterStateData
): string => {
  const endpointsResource = state.endpoints.items.find((endpoints) => {
    return (
      endpoints.metadata.name === service.metadata.name &&
      endpoints.metadata.namespace === service.metadata.namespace
    )
  })
  if (endpointsResource == null) {
    return '<none>'
  }
  return renderEndpointsInline(endpointsResource)
}

const renderEndpointsInline = (endpoints: Endpoints): string => {
  const subsets = endpoints.subsets ?? []
  const values: string[] = []
  for (const subset of subsets) {
    const addresses = subset.addresses ?? []
    const ports = subset.ports ?? []
    for (const address of addresses) {
      if (ports.length === 0) {
        values.push(address.ip)
        continue
      }
      for (const port of ports) {
        values.push(`${address.ip}:${port.port}`)
      }
    }
  }
  if (values.length === 0) {
    return '<none>'
  }
  return values.join(',')
}

export const describeEndpoints = (endpoints: Endpoints): string => {
  const lines: string[] = []
  lines.push(`Name:         ${endpoints.metadata.name}`)
  lines.push(`Namespace:    ${endpoints.metadata.namespace}`)
  lines.push(`Labels:       ${formatLabels(endpoints.metadata.labels)}`)
  lines.push(`Annotations:  ${formatLabels(endpoints.metadata.annotations)}`)
  lines.push(`Subsets:      ${renderEndpointsInline(endpoints)}`)
  lines.push('Events:       <none>')
  return lines.join('\n')
}

const renderEndpointSliceEndpointAddresses = (
  endpointSlice: EndpointSlice
): string => {
  const values = endpointSlice.endpoints.flatMap((endpoint) => endpoint.addresses)
  if (values.length === 0) {
    return '<none>'
  }
  return values.join(',')
}

const renderEndpointSlicePorts = (endpointSlice: EndpointSlice): string => {
  const ports = endpointSlice.ports ?? []
  if (ports.length === 0) {
    return '<none>'
  }
  const rendered = ports.map((port) => {
    const protocol = port.protocol ?? 'TCP'
    const portNumber = port.port != null ? String(port.port) : '<unset>'
    return `${portNumber}/${protocol}`
  })
  return rendered.join(',')
}

export const describeEndpointSlice = (endpointSlice: EndpointSlice): string => {
  const lines: string[] = []
  lines.push(`Name:         ${endpointSlice.metadata.name}`)
  lines.push(`Namespace:    ${endpointSlice.metadata.namespace}`)
  lines.push(`Labels:       ${formatLabels(endpointSlice.metadata.labels)}`)
  lines.push(`Annotations:  ${formatLabels(endpointSlice.metadata.annotations)}`)
  lines.push(`AddressType:  ${endpointSlice.addressType}`)
  lines.push(`Ports:        ${renderEndpointSlicePorts(endpointSlice)}`)
  lines.push(`Endpoints:    ${renderEndpointSliceEndpointAddresses(endpointSlice)}`)
  lines.push('Events:       <none>')
  return lines.join('\n')
}

export const describeService = (
  service: Service,
  state: ClusterStateData
): string => {
  const lines: string[] = []
  lines.push(`Name:                     ${service.metadata.name}`)
  lines.push(`Namespace:                ${service.metadata.namespace}`)
  lines.push(
    `Labels:                   ${formatLabels(service.metadata.labels)}`
  )
  lines.push(
    `Annotations:              ${formatLabels(service.metadata.annotations)}`
  )
  lines.push(`Selector:                 ${formatLabels(service.spec.selector)}`)
  lines.push(`Type:                     ${service.spec.type ?? 'ClusterIP'}`)
  lines.push('IP Family Policy:         SingleStack')
  lines.push('IP Families:              IPv4')
  lines.push(`IP:                       ${service.spec.clusterIP ?? '<none>'}`)
  lines.push(`IPs:                      ${service.spec.clusterIP ?? '<none>'}`)
  lines.push(`Port:                     ${renderServicePort(service, 0)}`)
  lines.push(`TargetPort:               ${renderServiceTargetPort(service, 0)}`)
  lines.push(
    `Endpoints:                ${renderServiceEndpoints(service, state)}`
  )
  lines.push(
    `Session Affinity:         ${service.spec.sessionAffinity ?? 'None'}`
  )
  lines.push('Internal Traffic Policy:  Cluster')
  lines.push('Events:                   <none>')
  return lines.join('\n')
}

export const describeIngress = (ingress: Ingress): string => {
  const lines: string[] = []
  lines.push(`Name:             ${ingress.metadata.name}`)
  lines.push(`Namespace:        ${ingress.metadata.namespace}`)
  lines.push(`Address:          <none>`)
  lines.push(`Ingress Class:    ${ingress.spec.ingressClassName ?? '<none>'}`)
  lines.push(`Rules:`)
  lines.push(`  Host              Path  Backends`)
  lines.push(`  ----              ----  --------`)

  for (const rule of ingress.spec.rules) {
    const host = rule.host ?? '*'
    lines.push(`  ${host}`)
    for (const pathRule of rule.http.paths) {
      const backendPort =
        pathRule.backend.service.port.number ??
        pathRule.backend.service.port.name
      lines.push(
        `                    ${pathRule.path}   ${pathRule.backend.service.name}:${String(backendPort)}`
      )
    }
  }

  lines.push('')
  lines.push('Events:           <none>')
  return lines.join('\n')
}

/**
 * Format detailed lease description
 */
export const describeLease = (lease: Lease): string => {
  const lines: string[] = []

  // Basic metadata
  lines.push(`Name:         ${lease.metadata.name}`)
  lines.push(`Namespace:    ${lease.metadata.namespace}`)
  lines.push(`Labels:       ${formatLabels(lease.metadata.labels)}`)
  lines.push(`Annotations:  ${formatLabels(lease.metadata.annotations)}`)
  lines.push(`API Version:  ${lease.apiVersion}`)
  lines.push(`Kind:         ${lease.kind}`)
  lines.push('Metadata:')
  lines.push(
    `  Creation Timestamp:  ${formatDescribeDate(lease.metadata.creationTimestamp)}`
  )

  // Owner References
  if (
    lease.metadata.ownerReferences &&
    lease.metadata.ownerReferences.length > 0
  ) {
    lines.push('  Owner References:')
    for (const ownerRef of lease.metadata.ownerReferences) {
      lines.push(`    API Version:     ${ownerRef.apiVersion}`)
      lines.push(`    Kind:            ${ownerRef.kind}`)
      lines.push(`    Name:            ${ownerRef.name}`)
      lines.push(`    UID:             ${ownerRef.uid}`)
    }
  } else {
    lines.push('  Owner References:  <none>')
  }

  if (lease.metadata.resourceVersion) {
    lines.push(`  Resource Version:  ${lease.metadata.resourceVersion}`)
  }
  if (lease.metadata.uid) {
    lines.push(`  UID:               ${lease.metadata.uid}`)
  }

  // Spec
  lines.push('Spec:')
  if (lease.spec.holderIdentity) {
    lines.push(`  Holder Identity:         ${lease.spec.holderIdentity}`)
  } else {
    lines.push('  Holder Identity:         <none>')
  }
  if (lease.spec.leaseDurationSeconds != null) {
    lines.push(`  Lease Duration Seconds:  ${lease.spec.leaseDurationSeconds}`)
  }
  if (lease.spec.renewTime) {
    lines.push(`  Renew Time:              ${lease.spec.renewTime}`)
  }

  lines.push('Events:                    <none>')

  return lines.join('\n')
}
