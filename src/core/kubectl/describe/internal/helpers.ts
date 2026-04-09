// Auto-exported helpers for describe describers (split from describeFormatters)
import type { ClusterStateData } from '../../../cluster/ClusterState'
import type { DeploymentLifecycleDescribeEvent } from '../../../api/DeploymentLifecycleEventStore'
import type { PodLifecycleDescribeEvent } from '../../../api/PodLifecycleEventStore'
import type {
  Deployment,
  DeploymentCondition,
  DeploymentStrategyType
} from '../../../cluster/ressources/Deployment'
import { generateTemplateHash } from '../../../cluster/ressources/Deployment'
import type {
  Node,
  NodeCondition,
  NodeTaint
} from '../../../cluster/ressources/Node'
import type { ReplicaSet } from '../../../cluster/ressources/ReplicaSet'
import type {
  ContainerRuntimeStateDetails,
  ContainerStatus,
  EnvVar,
  Pod,
  PodToleration,
  Probe,
  Volume,
  VolumeMount
} from '../../../cluster/ressources/Pod'
import { isPodTerminating } from '../../../cluster/ressources/Pod'
import type { Secret } from '../../../cluster/ressources/Secret'
import { formatAge } from '../../../shared/formatter'
import { indent, kv } from '../../formatters/describeHelpers'

// ─── Helpers ─────────────────────────────────────────────────────────────

/**
 * Format labels/annotations as comma-separated key=value pairs
 */
export const formatLabels = (labels?: Record<string, string>): string => {
  if (!labels || Object.keys(labels).length === 0) {
    return '<none>'
  }
  return Object.entries(labels)
    .map(([key, value]) => `${key}=${value}`)
    .join(',')
}

export const sortRecordEntries = (
  values?: Record<string, string>
): Array<[string, string]> => {
  if (values == null) {
    return []
  }
  return Object.entries(values).sort(([leftKey], [rightKey]) => {
    return leftKey.localeCompare(rightKey)
  })
}

export const formatMapMultiLine = (
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

export const sanitizeDescribeAnnotations = (
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
export const simulatePodIP = (podName: string): string => {
  // Simple hash to generate consistent IP for same pod name
  let hash = 0
  for (let i = 0; i < podName.length; i++) {
    hash = (hash << 5) - hash + podName.charCodeAt(i)
    hash = hash & hash
  }
  const lastOctet = Math.abs(hash % 250) + 2
  return `172.17.0.${lastOctet}`
}

export const formatDescribeDate = (isoDate: string): string => {
  const parsed = new Date(isoDate)
  if (isNaN(parsed.getTime())) {
    return isoDate
  }
  return parsed.toUTCString()
}

export const POD_DESCRIBE_METADATA_COLUMN_WIDTH = 18

export const getDescribePodStatus = (pod: Pod): string => {
  if (isPodTerminating(pod)) {
    return 'Terminating'
  }
  return pod.status.phase
}

export const formatSelector = (selector: {
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

export const formatIntOrString = (value: number | string | undefined): string => {
  if (value === undefined) {
    return '<none>'
  }
  return String(value)
}

export const formatDeploymentReplicas = (deployment: Deployment): string => {
  const desired = deployment.spec.replicas ?? 1
  const updated = deployment.status.updatedReplicas ?? 0
  const total = deployment.status.replicas ?? 0
  const available = deployment.status.availableReplicas ?? 0
  const unavailable = deployment.status.unavailableReplicas ?? total - available
  return `${desired} desired | ${updated} updated | ${total} total | ${available} available | ${unavailable} unavailable`
}

export const formatStrategyType = (
  strategyType: DeploymentStrategyType | undefined
): string => {
  if (!strategyType) {
    return 'RollingUpdate'
  }
  return strategyType
}

export const formatTemplateEnv = (
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

export const formatDeploymentConditions = (
  conditions: DeploymentCondition[] | undefined
): string[] => {
  const lines: string[] = ['Conditions:']
  if (!conditions || conditions.length === 0) {
    lines.push('  <none>')
    return lines
  }

  lines.push('  Type           Status  Reason')
  lines.push('  ----           ------  ------')
  for (const condition of conditions) {
    lines.push(
      `  ${condition.type.padEnd(14)} ${condition.status.padEnd(7)} ${condition.reason ?? '<none>'}`
    )
  }

  return lines
}

export const hasDeploymentOwnerReference = (
  replicaSet: ReplicaSet,
  deployment: Deployment
): boolean => {
  const ownerReferences = replicaSet.metadata.ownerReferences ?? []
  return ownerReferences.some((ownerReference) => {
    return (
      ownerReference.kind === 'Deployment' &&
      ownerReference.name === deployment.metadata.name
    )
  })
}

export const compareReplicaSetsByCreationDate = (
  left: ReplicaSet,
  right: ReplicaSet
): number => {
  const leftTimestamp = Date.parse(left.metadata.creationTimestamp)
  const rightTimestamp = Date.parse(right.metadata.creationTimestamp)
  if (leftTimestamp === rightTimestamp) {
    return left.metadata.name.localeCompare(right.metadata.name)
  }
  return leftTimestamp - rightTimestamp
}

export const findDeploymentReplicaSets = (
  deployment: Deployment,
  state: ClusterStateData | undefined
): {
  newReplicaSet: ReplicaSet | undefined
  oldReplicaSets: ReplicaSet[]
} => {
  if (state == null) {
    return {
      newReplicaSet: undefined,
      oldReplicaSets: []
    }
  }
  const ownedReplicaSets = state.replicaSets.items
    .filter((replicaSet) => {
      if (replicaSet.metadata.namespace !== deployment.metadata.namespace) {
        return false
      }
      return hasDeploymentOwnerReference(replicaSet, deployment)
    })
    .sort(compareReplicaSetsByCreationDate)

  const templateHash = generateTemplateHash(deployment.spec.template)
  const expectedReplicaSetName = `${deployment.metadata.name}-${templateHash.substring(0, 10)}`
  const newReplicaSet = ownedReplicaSets.find((replicaSet) => {
    return replicaSet.metadata.name === expectedReplicaSetName
  })
  const oldReplicaSets = ownedReplicaSets.filter((replicaSet) => {
    return replicaSet.metadata.name !== expectedReplicaSetName
  })

  return {
    newReplicaSet,
    oldReplicaSets
  }
}

export const formatDeploymentReplicaSetReference = (
  replicaSet: ReplicaSet | undefined
): string => {
  if (replicaSet == null) {
    return '<none>'
  }
  const currentReplicas = replicaSet.status.replicas ?? 0
  const desiredReplicas = replicaSet.spec.replicas ?? 0
  return `${replicaSet.metadata.name} (${currentReplicas}/${desiredReplicas} replicas created)`
}

export const formatDeploymentOldReplicaSets = (
  replicaSets: readonly ReplicaSet[]
): string => {
  if (replicaSets.length === 0) {
    return '<none>'
  }
  return replicaSets
    .map((replicaSet) => {
      return formatDeploymentReplicaSetReference(replicaSet)
    })
    .join(', ')
}

export const formatDeploymentEvents = (
  events: readonly DeploymentLifecycleDescribeEvent[] | undefined
): string[] => {
  if (events == null || events.length === 0) {
    return ['Events:             <none>']
  }
  const sortedEvents = [...events].sort((left, right) => {
    return Date.parse(left.timestamp) - Date.parse(right.timestamp)
  })
  const lines: string[] = [
    'Events:',
    '  Type    Reason             Age   From                   Message',
    '  ----    ------             ----  ----                   -------'
  ]
  for (const event of sortedEvents) {
    lines.push(
      `  ${event.type.padEnd(6)}  ${event.reason.padEnd(17)}  ${formatAge(event.timestamp).padEnd(4)}  ${event.source.padEnd(21)}  ${event.message}`
    )
  }
  return lines
}

/**
 * Format probe configuration
 */
export const formatProbe = (probe: Probe): string[] => {
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
export const formatEnvVar = (env: EnvVar): string => {
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
export const formatVolumeMount = (mount: VolumeMount): string => {
  const readOnlyStr = mount.readOnly ? '(ro)' : '(rw)'
  return `      ${mount.mountPath} from ${mount.name} ${readOnlyStr}`
}

/**
 * Format volume source
 */
export const formatVolumeSource = (volume: Volume): string => {
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

export const stableHash = (value: string): string => {
  let hash = 0
  for (let index = 0; index < value.length; index++) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export const buildKubeApiAccessVolumeName = (pod: Pod): string => {
  const token = stableHash(
    `${pod.metadata.namespace}/${pod.metadata.name}`
  ).slice(0, 5)
  return `kube-api-access-${token}`
}

/**
 * Format secret type for display
 */
export const formatSecretType = (secretType: Secret['type']): string => {
  if (secretType.type === 'Opaque') {
    return 'Opaque'
  }

  if (secretType.type === 'kubernetes.io/service-account-token') {
    return 'kubernetes.io/service-account-token'
  }

  if (secretType.type === 'kubernetes.io/dockerconfigjson') {
    return 'kubernetes.io/dockerconfigjson'
  }

  if (secretType.type === 'kubernetes.io/tls') {
    return 'kubernetes.io/tls'
  }

  return 'Unknown'
}

export const formatNodeTaints = (taints: NodeTaint[] | undefined): string => {
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

export const formatNodeConditions = (
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

export const formatNodeAddresses = (
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

export const formatNodeResourceList = (
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

export const formatNodeSystemInfo = (node: Node): string[] => {
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

export const isNonTerminatedPod = (pod: Pod): boolean => {
  return pod.status.phase !== 'Succeeded' && pod.status.phase !== 'Failed'
}

export const getNonTerminatedPodsOnNode = (
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

export const parseCpuToMilli = (value: string | undefined): number => {
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

export const parseMemoryToBytes = (value: string | undefined): number => {
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

export const calculatePercent = (used: number, total: number): number => {
  if (total <= 0) {
    return 0
  }
  return Math.floor((used / total) * 100)
}

export interface PodResourceTotals {
  cpuRequestsMilli: number
  cpuLimitsMilli: number
  memoryRequestsBytes: number
  memoryLimitsBytes: number
}

export const formatMemoryQuantity = (bytes: number): string => {
  if (bytes <= 0) {
    return '0'
  }
  const mebibytes = Math.round(bytes / 1024 ** 2)
  return `${mebibytes}Mi`
}

export const createEmptyPodResourceTotals = (): PodResourceTotals => {
  return {
    cpuRequestsMilli: 0,
    cpuLimitsMilli: 0,
    memoryRequestsBytes: 0,
    memoryLimitsBytes: 0
  }
}

export const getPodResources = (pod: Pod): PodResourceTotals => {
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

export const addPodResourcesToTotals = (
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

export const formatNonTerminatedPodRow = (
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

export const formatAllocatedResourceLines = (
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

export const formatNodePodResources = (node: Node, pods: Pod[]): string[] => {
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

export const resolveContainerStateDetails = (
  status: ContainerStatus | undefined
): ContainerRuntimeStateDetails | undefined => {
  return status?.stateDetails
}

export const resolveContainerLastStateDetails = (
  status: ContainerStatus | undefined
): ContainerRuntimeStateDetails | undefined => {
  if (status == null) {
    return undefined
  }
  return status.lastStateDetails
}

export const appendContainerStateBlock = (
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
export const formatContainer = (
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

export const formatPodConditionLines = (pod: Pod): string[] => {
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

export const formatPodTolerations = (tolerations?: PodToleration[]): string[] => {
  if (tolerations == null || tolerations.length === 0) {
    return ['Tolerations:       <none>']
  }
  const lines: string[] = []
  tolerations.forEach((toleration, index) => {
    const key = toleration.key ?? ''
    const value = toleration.value != null ? `=${toleration.value}` : ''
    const effect = toleration.effect ?? '<none>'
    const operator = toleration.operator ?? 'Equal'
    const tolerationSecondsSuffix =
      toleration.tolerationSeconds != null
        ? ` for ${toleration.tolerationSeconds}s`
        : ''
    const rendered = `${key}${value}:${effect} op=${operator}${tolerationSecondsSuffix}`
    if (index === 0) {
      lines.push(`Tolerations:       ${rendered}`)
      return
    }
    lines.push(`                   ${rendered}`)
  })
  return lines
}

export const formatDefaultPodEvents = (pod: Pod, nodeName: string): string[] => {
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

export const getPrimaryContainerStatus = (pod: Pod): ContainerStatus | undefined => {
  const primaryContainer = pod.spec.containers[0]
  if (primaryContainer == null) {
    return undefined
  }
  return (pod.status.containerStatuses ?? []).find((status) => {
    return status.name === primaryContainer.name
  })
}

export const formatPodLifecycleWarningEvents = (
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

export const formatPodEvents = (pod: Pod, nodeName: string): string[] => {
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

export const formatStoredPodEvents = (
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

export const formatStaticControlPlaneHeader = (
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

export const getPodControlledBy = (
  pod: Pod,
  staticPodControlledBy?: string
): string | undefined => {
  const ownerReferences = pod.metadata.ownerReferences ?? []
  const controllerOwnerReference = ownerReferences.find((ownerReference) => {
    return ownerReference.controller === true
  })
  if (controllerOwnerReference != null) {
    return `${controllerOwnerReference.kind}/${controllerOwnerReference.name}`
  }
  const firstOwnerReference = ownerReferences[0]
  if (firstOwnerReference != null) {
    return `${firstOwnerReference.kind}/${firstOwnerReference.name}`
  }
  if (staticPodControlledBy != null) {
    return staticPodControlledBy
  }
  return undefined
}

export const formatProbeInline = (title: string, probe: Probe): string => {
  const titleLabel = `${title}:`.padEnd(14)
  if (probe.type === 'httpGet') {
    const delay = probe.initialDelaySeconds ?? 0
    const timeout = probe.timeoutSeconds ?? 1
    const period = probe.periodSeconds ?? 10
    const success = probe.successThreshold ?? 1
    const failure = probe.failureThreshold ?? 3
    return `    ${titleLabel}http-get http://:${probe.port}${probe.path} delay=${delay}s timeout=${timeout}s period=${period}s #success=${success} #failure=${failure}`
  }
  if (probe.type === 'tcpSocket') {
    return `    ${titleLabel}tcp-socket :${probe.port}`
  }
  if (probe.type === 'exec') {
    return `    ${titleLabel}exec [${probe.command.join(' ')}]`
  }
  return `    ${titleLabel}<unknown>`
}
