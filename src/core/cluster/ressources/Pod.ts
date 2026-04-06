// ═══════════════════════════════════════════════════════════════════════════
// POD MODEL (ENHANCED)
// ═══════════════════════════════════════════════════════════════════════════
// Kubernetes Pod with ADT patterns for type-safe probes, env vars, and volumes
// Includes Zod schemas for YAML manifest validation

import { z } from 'zod'
import type { FileSystemState } from '../../filesystem/FileSystem'
import { createDebianFileSystem } from '../../filesystem/debianFileSystem'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import {
  applyVolumeMountBindingsToFileSystem,
  createConfigMapProvider,
  createEmptyDirProvider,
  createHostPathProvider,
  createPersistentVolumeClaimProvider,
  createPodVolumeRuntimeManager,
  createSecretProvider,
  getPersistentVolumeBackingStore,
  type PodVolumeBackingMap,
  type VolumeRuntimeContext
} from '../../volumes/runtime'
import type { KubernetesResource } from '../repositories/types'
import {
  convertYamlEnvVar,
  convertYamlProbe,
  convertYamlVolume
} from './yamlConverters'

export type PodPhase =
  | 'Pending'
  | 'Running'
  | 'Succeeded'
  | 'Failed'
  | 'Unknown'

// ─── Probes ────────────────────────────────────────────────────────

export type Probe =
  | {
      type: 'httpGet'
      path: string
      port: number
      initialDelaySeconds?: number
      periodSeconds?: number
      timeoutSeconds?: number
      successThreshold?: number
      failureThreshold?: number
    }
  | {
      type: 'exec'
      command: string[]
      initialDelaySeconds?: number
      periodSeconds?: number
      timeoutSeconds?: number
      successThreshold?: number
      failureThreshold?: number
    }
  | {
      type: 'tcpSocket'
      port: number
      initialDelaySeconds?: number
      periodSeconds?: number
      timeoutSeconds?: number
      successThreshold?: number
      failureThreshold?: number
    }

// ─── Environment Variables ─────────────────────────────────────────

type EnvVarSource =
  | { type: 'value'; value: string }
  | { type: 'configMapKeyRef'; name: string; key: string }
  | { type: 'secretKeyRef'; name: string; key: string }

export interface EnvVar {
  name: string
  source: EnvVarSource
}

// ─── Volumes ───────────────────────────────────────────────────────

export type VolumeSource =
  | { type: 'emptyDir'; medium?: 'Memory'; sizeLimit?: string }
  | { type: 'hostPath'; path: string; hostPathType?: string }
  | { type: 'persistentVolumeClaim'; claimName: string; readOnly?: boolean }
  | {
      type: 'configMap'
      name: string
      defaultMode?: number
      items?: Array<{
        key: string
        path: string
      }>
    }
  | { type: 'secret'; secretName: string }

export interface Volume {
  name: string
  source: VolumeSource
}

export interface VolumeMount {
  name: string
  mountPath: string
  readOnly?: boolean
}

// ─── Resource Requirements ───────────────────────────────────────────────

interface ResourceRequirements {
  requests?: {
    cpu?: string
    memory?: string
  }
  limits?: {
    cpu?: string
    memory?: string
  }
}

// ─── Container ───────────────────────────────────────────────────────────

interface ContainerPort {
  containerPort: number
  name?: string
  protocol?: 'TCP' | 'UDP'
}

export interface Container {
  name: string
  image: string
  imagePullPolicy?: string
  command?: string[]
  args?: string[]
  ports?: ContainerPort[]
  resources?: ResourceRequirements
  env?: EnvVar[]
  volumeMounts?: VolumeMount[]
  livenessProbe?: Probe
  readinessProbe?: Probe
  startupProbe?: Probe
  securityContext?: Record<string, unknown>
  terminationMessagePath?: string
  terminationMessagePolicy?: string
}

// ─── Pod Structure ───────────────────────────────────────────────────────

export interface OwnerReference {
  apiVersion: string
  kind: string
  name: string
  uid: string
  controller?: boolean
}

interface PodMetadata {
  name: string
  namespace: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp: string
  deletionTimestamp?: string
  deletionGracePeriodSeconds?: number
  generation?: number
  ownerReferences?: OwnerReference[]
}

export interface PodToleration {
  key?: string
  operator?: 'Exists' | 'Equal'
  value?: string
  effect?: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute'
  tolerationSeconds?: number
}

export interface PodNodeSelectorRequirement {
  key: string
  operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist'
  values?: string[]
}

export interface PodNodeSelectorTerm {
  matchExpressions?: PodNodeSelectorRequirement[]
}

export interface PodNodeAffinityRequired {
  nodeSelectorTerms: PodNodeSelectorTerm[]
}

export interface PodAffinity {
  nodeAffinity?: {
    requiredDuringSchedulingIgnoredDuringExecution?: PodNodeAffinityRequired
  }
}

interface PodSpec {
  nodeName?: string
  nodeSelector?: Record<string, string>
  tolerations?: PodToleration[]
  affinity?: PodAffinity
  restartPolicy?: 'Always' | 'OnFailure' | 'Never'
  initContainers?: readonly Container[]
  containers: readonly Container[]
  volumes?: Volume[]
}

export interface ContainerStatus {
  name: string
  image: string
  ready: boolean
  restartCount: number
  lastRestartAt?: string
  stateDetails?: ContainerRuntimeStateDetails
  started?: boolean
  startedAt?: string
  containerID?: string
  imageID?: string
  lastStateDetails?: ContainerRuntimeStateDetails
}

export interface ContainerRuntimeStateDetails {
  state: 'Waiting' | 'Running' | 'Terminated'
  reason?: string
  exitCode?: number
  startedAt?: string
  finishedAt?: string
}

export type PodQosClass = 'Guaranteed' | 'Burstable' | 'BestEffort'

export interface PodCondition {
  type:
    | 'Initialized'
    | 'Ready'
    | 'ContainersReady'
    | 'PodScheduled'
    | 'PodReadyToStartContainers'
  status: 'True' | 'False' | 'Unknown'
  lastTransitionTime: string
  lastProbeTime?: string | null
  observedGeneration?: number
}

interface PodStatus {
  phase: PodPhase
  podIP?: string
  podIPs?: Array<{ ip: string }>
  hostIP?: string
  hostIPs?: Array<{ ip: string }>
  startTime?: string
  qosClass?: PodQosClass
  observedGeneration?: number
  conditions?: PodCondition[]
  restartCount: number
  containerStatuses?: ContainerStatus[]
}

export interface PodLogEntry {
  timestamp: string
  line: string
}

export interface PodLogStreamState {
  seed: string
  lastGeneratedAtMs: number
  nextSequence: number
}

export interface Pod extends KubernetesResource {
  apiVersion: 'v1'
  kind: 'Pod'
  metadata: PodMetadata
  spec: PodSpec
  status: PodStatus
  _simulator: {
    logs?: string[]
    /** Logs from the previous container instance (before last restart), for kubectl logs --previous */
    previousLogs?: string[]
    logEntries?: PodLogEntry[]
    previousLogEntries?: PodLogEntry[]
    logStreamState?: PodLogStreamState
    volumeBackings: PodVolumeBackingMap
    containers: {
      [containerName: string]: {
        fileSystem: FileSystemState
        containerType: 'init' | 'regular'
      }
    }
  }
}

/** Override container status (e.g. from YAML status) for display in kubectl get pods */
interface ContainerStatusOverride {
  name: string
  ready?: boolean
  restartCount?: number
  lastRestartAt?: string
  stateDetails?: ContainerRuntimeStateDetails
}

interface PodConfig {
  name: string
  namespace: string
  nodeName?: string
  nodeSelector?: Record<string, string>
  tolerations?: PodToleration[]
  affinity?: PodAffinity
  restartPolicy?: 'Always' | 'OnFailure' | 'Never'
  initContainers?: Container[]
  containers: Container[]
  volumes?: Volume[]
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp?: string
  deletionTimestamp?: string
  deletionGracePeriodSeconds?: number
  phase?: PodPhase
  podIP?: string
  podIPs?: Array<{ ip: string }>
  hostIP?: string
  hostIPs?: Array<{ ip: string }>
  startTime?: string
  qosClass?: PodQosClass
  observedGeneration?: number
  conditions?: PodCondition[]
  restartCount?: number
  logs?: string[]
  /** Logs from the previous container instance (for tests / kubectl logs --previous) */
  previousLogs?: string[]
  logEntries?: PodLogEntry[]
  previousLogEntries?: PodLogEntry[]
  logStreamState?: PodLogStreamState
  ownerReferences?: OwnerReference[]
  /** Override container statuses (from YAML status) for display */
  containerStatusOverrides?: ContainerStatusOverride[]
}

const stableHash = (value: string): string => {
  let hash = 0
  for (let index = 0; index < value.length; index++) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/**
 * Image reference to path without tag (e.g. nginx:1.28 -> docker.io/library/nginx).
 * Matches kubectl/kind style: default registry docker.io/library, no tag in path.
 */
const imageRefToPath = (image: string): string => {
  const trimmed = image.trim()
  let registry = 'docker.io/library'
  let nameWithTag = trimmed
  const firstSlash = trimmed.indexOf('/')
  const firstColon = trimmed.indexOf(':')
  if (firstSlash !== -1 && (firstColon === -1 || firstSlash < firstColon)) {
    registry = trimmed.substring(0, firstSlash)
    nameWithTag = trimmed.substring(firstSlash + 1)
  }
  const colonIndex = nameWithTag.indexOf(':')
  const name =
    colonIndex !== -1 ? nameWithTag.substring(0, colonIndex) : nameWithTag
  return `${registry}/${name}`
}

/** 64-char hex digest from image string (deterministic, kind-style). */
const imageToSha256Digest = (image: string): string => {
  const parts: string[] = []
  for (let i = 0; i < 8; i++) {
    parts.push(stableHash(image + String(i)))
  }
  return parts.join('')
}

export const computeContainerImageId = (image: string): string => {
  const path = imageRefToPath(image)
  const digest = imageToSha256Digest(image)
  return `${path}@sha256:${digest}`
}

export const isPodTerminating = (pod: Pod): boolean => {
  const deletionTimestamp = pod.metadata.deletionTimestamp
  if (deletionTimestamp == null) {
    return false
  }
  return deletionTimestamp.length > 0
}

export const getPodDeletionGracePeriodSeconds = (
  pod: Pod,
  fallbackSeconds: number
): number => {
  const configured = pod.metadata.deletionGracePeriodSeconds
  if (configured == null) {
    return fallbackSeconds
  }
  if (!Number.isFinite(configured)) {
    return fallbackSeconds
  }
  const normalized = Math.floor(configured)
  if (normalized < 0) {
    return fallbackSeconds
  }
  return normalized
}

const computeContainerId = (
  namespace: string,
  podName: string,
  containerName: string
): string => {
  const digest = stableHash(`${namespace}/${podName}/${containerName}`)
    .repeat(8)
    .slice(0, 64)
  return `containerd://${digest}`
}

const hasCpuAndMemory = (
  resources: Container['resources'] | undefined,
  kind: 'requests' | 'limits'
): boolean => {
  if (resources == null) {
    return false
  }
  const values = resources[kind]
  if (values == null) {
    return false
  }
  if (typeof values.cpu !== 'string' || values.cpu.length === 0) {
    return false
  }
  if (typeof values.memory !== 'string' || values.memory.length === 0) {
    return false
  }
  return true
}

const isGuaranteedContainer = (container: Container): boolean => {
  const resources = container.resources
  if (!hasCpuAndMemory(resources, 'requests')) {
    return false
  }
  if (!hasCpuAndMemory(resources, 'limits')) {
    return false
  }
  if (
    resources == null ||
    resources.requests == null ||
    resources.limits == null
  ) {
    return false
  }
  return (
    resources.requests.cpu === resources.limits.cpu &&
    resources.requests.memory === resources.limits.memory
  )
}

const hasAnyResources = (container: Container): boolean => {
  const resources = container.resources
  if (resources == null) {
    return false
  }
  const hasCpuRequest =
    typeof resources.requests?.cpu === 'string' &&
    resources.requests.cpu.length > 0
  const hasMemoryRequest =
    typeof resources.requests?.memory === 'string' &&
    resources.requests.memory.length > 0
  const hasCpuLimit =
    typeof resources.limits?.cpu === 'string' && resources.limits.cpu.length > 0
  const hasMemoryLimit =
    typeof resources.limits?.memory === 'string' &&
    resources.limits.memory.length > 0
  return hasCpuRequest || hasMemoryRequest || hasCpuLimit || hasMemoryLimit
}

export const computePodQosClassFromContainers = (
  containers: readonly Container[]
): PodQosClass => {
  if (containers.length === 0) {
    return 'BestEffort'
  }
  const guaranteed = containers.every((container) =>
    isGuaranteedContainer(container)
  )
  if (guaranteed) {
    return 'Guaranteed'
  }
  const hasResources = containers.some((container) =>
    hasAnyResources(container)
  )
  if (hasResources) {
    return 'Burstable'
  }
  return 'BestEffort'
}

const buildPodConditions = (
  phase: PodPhase,
  nodeName: string | undefined,
  regularContainerStatuses: ContainerStatus[],
  transitionTime: string,
  observedGeneration: number | undefined,
  initContainersCount: number
): PodCondition[] => {
  const allRegularReady =
    regularContainerStatuses.length > 0 &&
    regularContainerStatuses.every((status) => status.ready === true)
  const initialized =
    initContainersCount === 0 || phase === 'Running' || phase === 'Succeeded'
  const ready = phase === 'Running' && allRegularReady
  const podScheduled = nodeName != null && nodeName.length > 0
  const toCondition = (
    type: PodCondition['type'],
    status: PodCondition['status']
  ): PodCondition => {
    return {
      type,
      status,
      lastTransitionTime: transitionTime,
      lastProbeTime: null,
      ...(observedGeneration != null ? { observedGeneration } : {})
    }
  }
  return [
    toCondition('Initialized', initialized ? 'True' : 'False'),
    toCondition('Ready', ready ? 'True' : 'False'),
    toCondition('ContainersReady', ready ? 'True' : 'False'),
    toCondition('PodScheduled', podScheduled ? 'True' : 'False')
  ]
}

const persistentVolumeBackingStore = getPersistentVolumeBackingStore()

const podVolumeRuntimeManager = createPodVolumeRuntimeManager([
  createEmptyDirProvider(),
  createConfigMapProvider(),
  createHostPathProvider(),
  createPersistentVolumeClaimProvider(persistentVolumeBackingStore),
  createSecretProvider()
])

export const buildPodResolvConf = (namespace: string): string => {
  const safeNamespace = namespace.trim() || 'default'
  return [
    `search ${safeNamespace}.svc.cluster.local svc.cluster.local cluster.local`,
    'nameserver 10.96.0.10',
    'options ndots:5'
  ].join('\n')
}

const buildContainerRootFileSystem = (
  podName: string,
  namespace: string
): FileSystemState => {
  return createDebianFileSystem({
    hostname: podName,
    resolvConf: buildPodResolvConf(namespace)
  })
}

const buildContainerFileSystemWithVolumes = (
  podName: string,
  namespace: string,
  container: Container,
  volumes: readonly Volume[] | undefined,
  volumeBackings: PodVolumeBackingMap
): FileSystemState => {
  const rootFileSystem = buildContainerRootFileSystem(podName, namespace)
  const mountBindings = podVolumeRuntimeManager.buildContainerMountBindings(
    container,
    volumes,
    volumeBackings
  )
  return applyVolumeMountBindingsToFileSystem(rootFileSystem, mountBindings)
}

export const createPod = (config: PodConfig): Pod => {
  const initialPhase = config.phase || 'Pending'
  const creationTimestamp = config.creationTimestamp || new Date().toISOString()
  const observedGeneration = config.observedGeneration ?? 1
  // Create container statuses for init containers
  const initContainerStatuses = (config.initContainers || []).map(
    (container) => ({
      name: container.name,
      image: container.image,
      ready: false,
      restartCount: 0,
      stateDetails: {
        state: 'Waiting' as const,
        reason: 'ContainerCreating'
      },
      started: false,
      imageID: computeContainerImageId(container.image)
    })
  )

  const overridesByName = new Map(
    (config.containerStatusOverrides ?? []).map((o) => [o.name, o])
  )

  const regularContainerStatuses = config.containers.map((container) => {
    const override = overridesByName.get(container.name)
    const ready = override?.ready ?? initialPhase === 'Running'
    const restartCount = override?.restartCount ?? 0
    const overrideState = override?.stateDetails?.state
    const state: 'Waiting' | 'Running' | 'Terminated' =
      overrideState ?? (initialPhase === 'Running' ? 'Running' : 'Waiting')
    const isStarted = state === 'Running'
    const startedAt = isStarted ? creationTimestamp : undefined
    const stateDetails: ContainerRuntimeStateDetails =
      override?.stateDetails != null
        ? override.stateDetails
        : state === 'Running'
          ? {
              state: 'Running',
              startedAt
            }
          : state === 'Terminated'
            ? {
                state: 'Terminated',
                reason: 'Completed',
                exitCode: 0
              }
            : {
                state: 'Waiting',
                reason: 'ContainerCreating'
              }
    return {
      name: container.name,
      image: container.image,
      ready,
      restartCount,
      stateDetails,
      started: isStarted,
      ...(startedAt != null ? { startedAt } : {}),
      containerID: computeContainerId(
        config.namespace,
        config.name,
        container.name
      ),
      imageID: computeContainerImageId(container.image),
      ...(override?.lastRestartAt != null && {
        lastRestartAt: override.lastRestartAt
      })
    }
  })

  // Combine: init containers first, then regular containers
  const allContainerStatuses = [
    ...initContainerStatuses,
    ...regularContainerStatuses
  ]
  const podIP = config.podIP
  const podIPs = config.podIPs ?? (podIP != null ? [{ ip: podIP }] : undefined)
  const hostIP = config.hostIP
  const hostIPs =
    config.hostIPs ?? (hostIP != null ? [{ ip: hostIP }] : undefined)
  const startTime =
    config.startTime ??
    (initialPhase === 'Running' ? creationTimestamp : undefined)
  const qosClass =
    config.qosClass ?? computePodQosClassFromContainers(config.containers)
  const regularStatuses = allContainerStatuses.filter((status) => {
    return (
      (config.initContainers ?? []).some(
        (container) => container.name === status.name
      ) === false
    )
  })
  const conditions =
    config.conditions ??
    buildPodConditions(
      initialPhase,
      config.nodeName,
      regularStatuses,
      creationTimestamp,
      observedGeneration,
      (config.initContainers ?? []).length
    )

  const volumeBackings = podVolumeRuntimeManager.ensurePodVolumeBackings(
    config.volumes,
    {}
  )
  const cleanedVolumeBackings =
    podVolumeRuntimeManager.cleanupPodVolumeBackings(
      config.volumes,
      volumeBackings
    )

  // Create _simulator.containers with fileSystem and containerType
  const simulatorContainers: Pod['_simulator']['containers'] = {}

  // Add init containers
  for (const container of config.initContainers || []) {
    simulatorContainers[container.name] = {
      fileSystem: buildContainerFileSystemWithVolumes(
        config.name,
        config.namespace,
        container,
        config.volumes,
        cleanedVolumeBackings
      ),
      containerType: 'init'
    }
  }

  // Add regular containers
  for (const container of config.containers) {
    simulatorContainers[container.name] = {
      fileSystem: buildContainerFileSystemWithVolumes(
        config.name,
        config.namespace,
        container,
        config.volumes,
        cleanedVolumeBackings
      ),
      containerType: 'regular'
    }
  }

  const pod: Pod = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp,
      ...(config.deletionTimestamp != null && {
        deletionTimestamp: config.deletionTimestamp
      }),
      ...(config.deletionGracePeriodSeconds != null && {
        deletionGracePeriodSeconds: config.deletionGracePeriodSeconds
      }),
      ...(config.labels && { labels: config.labels }),
      ...(config.annotations && { annotations: config.annotations }),
      ...(config.ownerReferences && {
        ownerReferences: config.ownerReferences
      }),
      generation: observedGeneration
    },
    spec: {
      ...(config.nodeName && { nodeName: config.nodeName }),
      ...(config.nodeSelector && { nodeSelector: config.nodeSelector }),
      ...(config.tolerations && { tolerations: config.tolerations }),
      ...(config.affinity && { affinity: config.affinity }),
      ...(config.restartPolicy && { restartPolicy: config.restartPolicy }),
      ...(config.initContainers && { initContainers: config.initContainers }),
      containers: config.containers,
      ...(config.volumes && { volumes: config.volumes })
    },
    status: {
      phase: initialPhase,
      ...(podIP != null && { podIP }),
      ...(podIPs != null ? { podIPs } : {}),
      ...(hostIP != null ? { hostIP } : {}),
      ...(hostIPs != null ? { hostIPs } : {}),
      ...(startTime != null ? { startTime } : {}),
      qosClass,
      observedGeneration,
      conditions,
      restartCount: config.restartCount || 0,
      containerStatuses: allContainerStatuses
    },
    _simulator: {
      ...(config.logs && { logs: config.logs }),
      ...(config.previousLogs && { previousLogs: config.previousLogs }),
      ...(config.logEntries && { logEntries: config.logEntries }),
      ...(config.previousLogEntries && {
        previousLogEntries: config.previousLogEntries
      }),
      ...(config.logStreamState && { logStreamState: config.logStreamState }),
      volumeBackings: cleanedVolumeBackings,
      containers: simulatorContainers
    }
  }

  return deepFreeze(pod)
}

const findPodContainerByName = (
  pod: Pod,
  containerName: string
): Container | undefined => {
  const initContainer = (pod.spec.initContainers ?? []).find((container) => {
    return container.name === containerName
  })
  if (initContainer != null) {
    return initContainer
  }
  return pod.spec.containers.find((container) => {
    return container.name === containerName
  })
}

export const normalizePodVolumeBackings = (
  pod: Pod,
  context?: VolumeRuntimeContext
): PodVolumeBackingMap => {
  const ensuredBackings = podVolumeRuntimeManager.ensurePodVolumeBackings(
    pod.spec.volumes,
    pod._simulator.volumeBackings,
    context
  )
  return podVolumeRuntimeManager.cleanupPodVolumeBackings(
    pod.spec.volumes,
    ensuredBackings
  )
}

export const buildPodContainerFileSystem = (
  pod: Pod,
  containerName: string,
  context?: VolumeRuntimeContext
): Result<{
  fileSystem: FileSystemState
  volumeBackings: PodVolumeBackingMap
}> => {
  const container = findPodContainerByName(pod, containerName)
  if (container == null) {
    return error(
      `Error: container ${containerName} not found in pod ${pod.metadata.name}`
    )
  }
  const volumeBackings = normalizePodVolumeBackings(pod, context)
  const fileSystem = buildContainerFileSystemWithVolumes(
    pod.metadata.name,
    pod.metadata.namespace,
    container,
    pod.spec.volumes,
    volumeBackings
  )
  return success({
    fileSystem,
    volumeBackings
  })
}

export const hydratePodVolumeRuntime = (
  pod: Pod,
  context?: VolumeRuntimeContext
): Result<Pod> => {
  let workingPod = pod
  let volumeBackings = normalizePodVolumeBackings(workingPod, context)
  const updatedContainers: Pod['_simulator']['containers'] = {
    ...workingPod._simulator.containers
  }
  for (const [containerName, entry] of Object.entries(
    workingPod._simulator.containers
  )) {
    const fileSystemResult = buildPodContainerFileSystem(
      {
        ...workingPod,
        _simulator: {
          ...workingPod._simulator,
          volumeBackings: volumeBackings
        }
      },
      containerName,
      context
    )
    if (!fileSystemResult.ok) {
      return error(fileSystemResult.error)
    }
    volumeBackings = fileSystemResult.value.volumeBackings
    updatedContainers[containerName] = {
      ...entry,
      fileSystem: fileSystemResult.value.fileSystem
    }
  }
  return success({
    ...workingPod,
    _simulator: {
      ...workingPod._simulator,
      volumeBackings: volumeBackings,
      containers: updatedContainers
    }
  })
}

// ─── Zod Schemas for YAML Validation (internal use only) ────────────────

const ContainerSchema = z.object({
  name: z.string().min(1, 'Container name is required'),
  image: z.string().min(1, 'Container image is required'),
  imagePullPolicy: z.string().optional(),
  command: z.array(z.string()).optional(),
  args: z.array(z.string()).optional(),
  ports: z
    .array(
      z.object({
        containerPort: z.number().int().positive(),
        name: z.string().optional(),
        protocol: z.enum(['TCP', 'UDP']).optional()
      })
    )
    .optional(),
  resources: z
    .object({
      requests: z
        .object({
          cpu: z.string(),
          memory: z.string()
        })
        .optional(),
      limits: z
        .object({
          cpu: z.string(),
          memory: z.string()
        })
        .optional()
    })
    .optional(),
  env: z.array(z.any()).optional(),
  volumeMounts: z.array(z.any()).optional(),
  livenessProbe: z.any().optional(),
  readinessProbe: z.any().optional(),
  startupProbe: z.any().optional(),
  securityContext: z.any().optional(),
  terminationMessagePath: z.string().optional(),
  terminationMessagePolicy: z.string().optional()
})

const PodManifestSchema = z.object({
  apiVersion: z.literal('v1'),
  kind: z.literal('Pod'),
  metadata: z.object({
    name: z.string().min(1, 'Pod name is required'),
    namespace: z.string().default('default'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  spec: z.object({
    nodeName: z.string().optional(),
    nodeSelector: z.record(z.string(), z.string()).optional(),
    restartPolicy: z.enum(['Always', 'OnFailure', 'Never']).optional(),
    initContainers: z.array(ContainerSchema).optional(),
    containers: z
      .array(ContainerSchema)
      .min(1, 'At least one container is required'),
    volumes: z.array(z.any()).optional(),
    tolerations: z
      .array(
        z.object({
          key: z.string().optional(),
          operator: z.enum(['Exists', 'Equal']).optional(),
          value: z.string().optional(),
          effect: z
            .enum(['NoSchedule', 'PreferNoSchedule', 'NoExecute'])
            .optional()
        })
      )
      .optional(),
    affinity: z
      .object({
        nodeAffinity: z
          .object({
            requiredDuringSchedulingIgnoredDuringExecution: z
              .object({
                nodeSelectorTerms: z.array(
                  z.object({
                    matchExpressions: z
                      .array(
                        z.object({
                          key: z.string(),
                          operator: z.enum([
                            'In',
                            'NotIn',
                            'Exists',
                            'DoesNotExist'
                          ]),
                          values: z.array(z.string()).optional()
                        })
                      )
                      .optional()
                  })
                )
              })
              .optional()
          })
          .optional()
      })
      .optional()
  }),
  status: z
    .object({
      phase: z
        .enum(['Pending', 'Running', 'Succeeded', 'Failed', 'Unknown'])
        .optional(),
      podIP: z.string().optional(),
      restartCount: z.number().optional(),
      containerStatuses: z
        .array(
          z.object({
            name: z.string(),
            ready: z.boolean().optional(),
            restartCount: z.number().optional(),
            state: z
              .object({
                waiting: z.object({ reason: z.string() }).optional(),
                terminated: z
                  .object({
                    reason: z.string(),
                    exitCode: z.number().optional()
                  })
                  .optional()
              })
              .optional()
          })
        )
        .optional()
    })
    .optional()
})

/**
 * Parse and validate Pod manifest from YAML
 */
export const parsePodManifest = (data: unknown): Result<Pod> => {
  const mountPathHasParentDirectorySegments = (mountPath: string): boolean => {
    const segments = mountPath
      .split('/')
      .filter((segment: string) => segment.length > 0)
    return segments.includes('..')
  }

  const result = PodManifestSchema.safeParse(data)

  if (!result.success) {
    const firstError = result.error.issues[0]
    return error(
      `Invalid Pod manifest: ${firstError.path.join('.')}: ${firstError.message}`
    )
  }

  const manifest = result.data
  const containerGroups = [
    {
      key: 'spec.initContainers',
      containers: manifest.spec.initContainers ?? []
    },
    {
      key: 'spec.containers',
      containers: manifest.spec.containers
    }
  ]
  for (const group of containerGroups) {
    for (const [containerIndex, container] of group.containers.entries()) {
      if (!Array.isArray(container.volumeMounts)) {
        continue
      }
      for (const [mountIndex, mount] of container.volumeMounts.entries()) {
        if (mount == null || typeof mount.mountPath !== 'string') {
          continue
        }
        if (!mountPathHasParentDirectorySegments(mount.mountPath)) {
          continue
        }
        return error(
          `Invalid Pod manifest: ${group.key}[${containerIndex}].volumeMounts[${mountIndex}].mountPath: mountPath must not contain ".." segments`
        )
      }
    }
  }

  // Convert volumes from YAML format to TypeScript format
  const volumes = manifest.spec.volumes
    ? manifest.spec.volumes
        .map(convertYamlVolume)
        .filter((v): v is Volume => v !== null)
    : undefined

  // Convert containers (env vars and probes)
  const convertContainer = (container: any): Container => {
    const converted: Container = {
      name: container.name,
      image: container.image,
      ...(container.command && { command: container.command }),
      ...(container.args && { args: container.args }),
      ...(container.ports && { ports: container.ports }),
      ...(container.resources && { resources: container.resources }),
      ...(container.volumeMounts && { volumeMounts: container.volumeMounts })
    }

    // Convert env vars
    if (container.env && Array.isArray(container.env)) {
      const envVars = container.env
        .map(convertYamlEnvVar)
        .filter((e: EnvVar | null): e is EnvVar => e !== null)
      if (envVars.length > 0) {
        converted.env = envVars
      }
    }

    // Convert probes
    if (container.livenessProbe) {
      const probe = convertYamlProbe(container.livenessProbe)
      if (probe) {
        converted.livenessProbe = probe
      }
    }
    if (container.readinessProbe) {
      const probe = convertYamlProbe(container.readinessProbe)
      if (probe) {
        converted.readinessProbe = probe
      }
    }
    if (container.startupProbe) {
      const probe = convertYamlProbe(container.startupProbe)
      if (probe) {
        converted.startupProbe = probe
      }
    }

    return converted
  }

  // Convert init containers
  const initContainers = manifest.spec.initContainers
    ? manifest.spec.initContainers.map(convertContainer)
    : undefined

  // Convert regular containers
  const containers = manifest.spec.containers.map(convertContainer)

  const containerStatusOverrides = manifest.status?.containerStatuses?.map(
    (cs) => ({
      name: cs.name,
      ...(cs.ready !== undefined && { ready: cs.ready }),
      ...(cs.restartCount !== undefined && { restartCount: cs.restartCount }),
      ...(cs.state?.waiting?.reason != null
        ? {
            stateDetails: {
              state: 'Waiting' as const,
              reason: cs.state.waiting.reason
            }
          }
        : {}),
      ...(cs.state?.terminated?.reason != null
        ? {
            stateDetails: {
              state: 'Terminated' as const,
              reason: cs.state.terminated.reason,
              exitCode: cs.state.terminated.exitCode ?? 1
            }
          }
        : {})
    })
  )

  const pod = createPod({
    name: manifest.metadata.name,
    namespace: manifest.metadata.namespace,
    ...(manifest.spec.nodeName && { nodeName: manifest.spec.nodeName }),
    ...(manifest.spec.nodeSelector && {
      nodeSelector: manifest.spec.nodeSelector
    }),
    ...(manifest.spec.tolerations && {
      tolerations: manifest.spec.tolerations
    }),
    ...(manifest.spec.affinity && { affinity: manifest.spec.affinity }),
    ...(manifest.spec.restartPolicy && {
      restartPolicy: manifest.spec.restartPolicy
    }),
    ...(initContainers && { initContainers }),
    containers,
    ...(volumes && { volumes }),
    ...(manifest.metadata.labels && { labels: manifest.metadata.labels }),
    ...(manifest.metadata.annotations && {
      annotations: manifest.metadata.annotations
    }),
    ...(manifest.metadata.creationTimestamp && {
      creationTimestamp: manifest.metadata.creationTimestamp
    }),
    ...(manifest.status?.phase && { phase: manifest.status.phase }),
    ...(manifest.status?.podIP && { podIP: manifest.status.podIP }),
    ...(manifest.status?.restartCount != null && {
      restartCount: manifest.status.restartCount
    }),
    ...(containerStatusOverrides &&
      containerStatusOverrides.length > 0 && {
        containerStatusOverrides
      })
  })

  return success(pod)
}
