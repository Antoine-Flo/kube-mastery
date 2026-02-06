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
import { convertYamlEnvVar, convertYamlProbe, convertYamlVolume } from './yamlConverters'

export type PodPhase = 'Pending' | 'Running' | 'Succeeded' | 'Failed' | 'Unknown'

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

interface PodSpec {
  nodeName?: string
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
}

interface PodStatus {
  phase: PodPhase
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

interface PodConfig {
  name: string
  namespace: string
  nodeName?: string
  initContainers?: Container[]
  containers: Container[]
  volumes?: Volume[]
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp?: string
  phase?: PodPhase
  restartCount?: number
  logs?: string[]
  ownerReferences?: OwnerReference[]
}

export const createPod = (config: PodConfig): Pod => {
  // Create container statuses for init containers
  const initContainerStatuses = (config.initContainers || []).map((container) => ({
    name: container.name,
    image: container.image,
    ready: false,
    restartCount: 0,
    state: 'Waiting' as const
  }))

  // Create container statuses for regular containers
  const regularContainerStatuses = config.containers.map((container) => ({
    name: container.name,
    image: container.image,
    ready: config.phase === 'Running',
    restartCount: 0,
    state: 'Waiting' as const
  }))

  // Combine: init containers first, then regular containers
  const allContainerStatuses = [...initContainerStatuses, ...regularContainerStatuses]

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
      ...(config.initContainers && { initContainers: config.initContainers }),
      containers: config.containers,
      ...(config.volumes && { volumes: config.volumes })
    },
    status: {
      phase: config.phase || 'Pending',
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
    initContainers: z.array(ContainerSchema).optional(),
    containers: z.array(ContainerSchema).min(1, 'At least one container is required'),
    volumes: z.array(z.any()).optional(),
    tolerations: z.array(z.any()).optional()
  }),
  status: z
    .object({
      phase: z.enum(['Pending', 'Running', 'Succeeded', 'Failed', 'Unknown']).optional(),
      restartCount: z.number().optional()
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
    return error(`Invalid Pod manifest: ${firstError.path.join('.')}: ${firstError.message}`)
  }

  const manifest = result.data

  // Convert volumes from YAML format to TypeScript format
  const volumes = manifest.spec.volumes
    ? manifest.spec.volumes.map(convertYamlVolume).filter((v): v is Volume => v !== null)
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
      const envVars = container.env.map(convertYamlEnvVar).filter((e: EnvVar | null): e is EnvVar => e !== null)
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
  const initContainers = manifest.spec.initContainers ? manifest.spec.initContainers.map(convertContainer) : undefined

  // Convert regular containers
  const containers = manifest.spec.containers.map(convertContainer)

  // Use createPod to properly initialize all container statuses
  const pod = createPod({
    name: manifest.metadata.name,
    namespace: manifest.metadata.namespace,
    ...(manifest.spec.nodeName && { nodeName: manifest.spec.nodeName }),
    ...(initContainers && { initContainers }),
    containers,
    ...(volumes && { volumes }),
    ...(manifest.metadata.labels && { labels: manifest.metadata.labels }),
    ...(manifest.metadata.annotations && { annotations: manifest.metadata.annotations }),
    ...(manifest.metadata.creationTimestamp && { creationTimestamp: manifest.metadata.creationTimestamp }),
    ...(manifest.status?.phase && { phase: manifest.status.phase }),
    ...(manifest.status?.restartCount && { restartCount: manifest.status.restartCount })
  })

  return success(pod)
}
