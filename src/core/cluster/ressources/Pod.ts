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
    }
  | {
      type: 'exec'
      command: string[]
      initialDelaySeconds?: number
      periodSeconds?: number
    }
  | {
      type: 'tcpSocket'
      port: number
      initialDelaySeconds?: number
      periodSeconds?: number
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
  | { type: 'emptyDir' }
  | { type: 'configMap'; name: string }
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
  protocol?: 'TCP' | 'UDP'
}

export interface Container {
  name: string
  image: string
  command?: string[]
  args?: string[]
  ports?: ContainerPort[]
  resources?: ResourceRequirements
  env?: EnvVar[]
  volumeMounts?: VolumeMount[]
  livenessProbe?: Probe
  readinessProbe?: Probe
  startupProbe?: Probe
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
  ownerReferences?: OwnerReference[]
}

export interface PodToleration {
  key?: string
  operator?: 'Exists' | 'Equal'
  value?: string
  effect?: 'NoSchedule' | 'PreferNoSchedule' | 'NoExecute'
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
  initContainers?: readonly Container[]
  containers: readonly Container[]
  volumes?: Volume[]
}

export interface ContainerStatus {
  name: string
  image: string
  ready: boolean
  restartCount: number
  state?: 'Waiting' | 'Running' | 'Terminated'
  /** Reason shown in kubectl get pods STATUS (e.g. ContainerCreating, ImagePullBackOff) */
  waitingReason?: string
  /** Reason when terminated (e.g. CrashLoopBackOff) */
  terminatedReason?: string
}

interface PodStatus {
  phase: PodPhase
  podIP?: string
  restartCount: number
  containerStatuses?: ContainerStatus[]
}

export interface Pod extends KubernetesResource {
  apiVersion: 'v1'
  kind: 'Pod'
  metadata: PodMetadata
  spec: PodSpec
  status: PodStatus
  _simulator: {
    logs?: string[]
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
  waitingReason?: string
  terminatedReason?: string
}

interface PodConfig {
  name: string
  namespace: string
  nodeName?: string
  nodeSelector?: Record<string, string>
  tolerations?: PodToleration[]
  affinity?: PodAffinity
  initContainers?: Container[]
  containers: Container[]
  volumes?: Volume[]
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp?: string
  phase?: PodPhase
  podIP?: string
  restartCount?: number
  logs?: string[]
  ownerReferences?: OwnerReference[]
  /** Override container statuses (from YAML status) for display */
  containerStatusOverrides?: ContainerStatusOverride[]
}

export const createPod = (config: PodConfig): Pod => {
  // Create container statuses for init containers
  const initContainerStatuses = (config.initContainers || []).map(
    (container) => ({
      name: container.name,
      image: container.image,
      ready: false,
      restartCount: 0,
      state: 'Waiting' as const
    })
  )

  const overridesByName = new Map(
    (config.containerStatusOverrides ?? []).map((o) => [o.name, o])
  )

  const regularContainerStatuses = config.containers.map((container) => {
    const override = overridesByName.get(container.name)
    const ready = override?.ready ?? config.phase === 'Running'
    const restartCount = override?.restartCount ?? 0
    const state: 'Waiting' | 'Running' | 'Terminated' =
      override?.terminatedReason != null
        ? 'Terminated'
        : override?.waitingReason != null
          ? 'Waiting'
          : config.phase === 'Running'
            ? 'Running'
            : 'Waiting'
    return {
      name: container.name,
      image: container.image,
      ready,
      restartCount,
      state,
      ...(override?.waitingReason != null && {
        waitingReason: override.waitingReason
      }),
      ...(override?.terminatedReason != null && {
        terminatedReason: override.terminatedReason
      })
    }
  })

  // Combine: init containers first, then regular containers
  const allContainerStatuses = [
    ...initContainerStatuses,
    ...regularContainerStatuses
  ]

  // Create _simulator.containers with fileSystem and containerType
  const simulatorContainers: Pod['_simulator']['containers'] = {}

  // Add init containers
  for (const container of config.initContainers || []) {
    simulatorContainers[container.name] = {
      fileSystem: createDebianFileSystem(),
      containerType: 'init'
    }
  }

  // Add regular containers
  for (const container of config.containers) {
    simulatorContainers[container.name] = {
      fileSystem: createDebianFileSystem(),
      containerType: 'regular'
    }
  }

  const pod: Pod = {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp: config.creationTimestamp || new Date().toISOString(),
      ...(config.labels && { labels: config.labels }),
      ...(config.annotations && { annotations: config.annotations }),
      ...(config.ownerReferences && { ownerReferences: config.ownerReferences })
    },
    spec: {
      ...(config.nodeName && { nodeName: config.nodeName }),
      ...(config.nodeSelector && { nodeSelector: config.nodeSelector }),
      ...(config.tolerations && { tolerations: config.tolerations }),
      ...(config.affinity && { affinity: config.affinity }),
      ...(config.initContainers && { initContainers: config.initContainers }),
      containers: config.containers,
      ...(config.volumes && { volumes: config.volumes })
    },
    status: {
      phase: config.phase || 'Pending',
      ...(config.podIP != null && { podIP: config.podIP }),
      restartCount: config.restartCount || 0,
      containerStatuses: allContainerStatuses
    },
    _simulator: {
      ...(config.logs && { logs: config.logs }),
      containers: simulatorContainers
    }
  }

  return deepFreeze(pod)
}

// ─── Zod Schemas for YAML Validation (internal use only) ────────────────

const ContainerSchema = z.object({
  name: z.string().min(1, 'Container name is required'),
  image: z.string().min(1, 'Container image is required'),
  command: z.array(z.string()).optional(),
  args: z.array(z.string()).optional(),
  ports: z
    .array(
      z.object({
        containerPort: z.number().int().positive(),
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
  startupProbe: z.any().optional()
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
          effect: z.enum(['NoSchedule', 'PreferNoSchedule', 'NoExecute']).optional()
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
                terminated: z.object({ reason: z.string() }).optional()
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
  const result = PodManifestSchema.safeParse(data)

  if (!result.success) {
    const firstError = result.error.issues[0]
    return error(
      `Invalid Pod manifest: ${firstError.path.join('.')}: ${firstError.message}`
    )
  }

  const manifest = result.data

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
      ...(cs.state?.waiting?.reason != null && {
        waitingReason: cs.state.waiting.reason
      }),
      ...(cs.state?.terminated?.reason != null && {
        terminatedReason: cs.state.terminated.reason
      })
    })
  )

  const pod = createPod({
    name: manifest.metadata.name,
    namespace: manifest.metadata.namespace,
    ...(manifest.spec.nodeName && { nodeName: manifest.spec.nodeName }),
    ...(manifest.spec.nodeSelector && { nodeSelector: manifest.spec.nodeSelector }),
    ...(manifest.spec.tolerations && { tolerations: manifest.spec.tolerations }),
    ...(manifest.spec.affinity && { affinity: manifest.spec.affinity }),
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
