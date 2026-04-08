// ═══════════════════════════════════════════════════════════════════════════
// DEPLOYMENT MODEL
// ═══════════════════════════════════════════════════════════════════════════
// Kubernetes Deployment resource for declarative Pod and ReplicaSet management
// Based on apps/v1 API spec

import { z } from 'zod'
import type {
  K8sDeployment,
  K8sDeploymentMetadata,
  K8sDeploymentSpec,
  K8sDeploymentStatus
} from '../../openapi/generated/k8sOpenapiAliases.generated'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { NamespacedFactoryConfigBase } from './resourceFactoryConfig'
import type { LabelSelector, PodTemplateSpec } from './ReplicaSet'

// ─── Deployment Strategy ──────────────────────────────────────────────────

export type DeploymentStrategyType = 'Recreate' | 'RollingUpdate'

export interface RollingUpdateDeployment {
  maxUnavailable?: number | string
  maxSurge?: number | string
}

export interface DeploymentStrategy {
  type?: DeploymentStrategyType
  rollingUpdate?: RollingUpdateDeployment
}

// ─── Deployment Spec ──────────────────────────────────────────────────────

export type DeploymentSpec = Omit<
  Pick<
    K8sDeploymentSpec,
    | 'replicas'
    | 'selector'
    | 'template'
    | 'strategy'
    | 'minReadySeconds'
    | 'revisionHistoryLimit'
    | 'paused'
    | 'progressDeadlineSeconds'
  >,
  'selector' | 'template' | 'strategy'
> & {
  selector: LabelSelector
  template: PodTemplateSpec
  strategy?: DeploymentStrategy
}

// ─── Deployment Condition ─────────────────────────────────────────────────

export type DeploymentConditionType =
  | 'Available'
  | 'Progressing'
  | 'ReplicaFailure'

export interface DeploymentCondition {
  type: DeploymentConditionType
  status: 'True' | 'False' | 'Unknown'
  lastUpdateTime?: string
  lastTransitionTime?: string
  reason?: string
  message?: string
}

// ─── Deployment Status ────────────────────────────────────────────────────

export type DeploymentStatus = Omit<
  Pick<
    K8sDeploymentStatus,
    | 'observedGeneration'
    | 'replicas'
    | 'updatedReplicas'
    | 'readyReplicas'
    | 'availableReplicas'
    | 'unavailableReplicas'
    | 'conditions'
    | 'collisionCount'
  >,
  'conditions'
> & {
  conditions?: DeploymentCondition[]
}

// ─── Deployment Metadata ──────────────────────────────────────────────────

type DeploymentMetadata = Pick<
  K8sDeploymentMetadata,
  | 'name'
  | 'namespace'
  | 'labels'
  | 'annotations'
  | 'creationTimestamp'
  | 'generation'
>

// ─── Deployment Resource ──────────────────────────────────────────────────

export type Deployment = Omit<K8sDeployment, 'metadata' | 'spec' | 'status'> & {
  metadata: DeploymentMetadata
  spec: DeploymentSpec
  status: DeploymentStatus
}

// ─── Factory ──────────────────────────────────────────────────────────────

interface DeploymentConfig extends NamespacedFactoryConfigBase {
  replicas?: number
  selector: LabelSelector
  template: PodTemplateSpec
  strategy?: DeploymentStrategy
  minReadySeconds?: number
  revisionHistoryLimit?: number
  paused?: boolean
  progressDeadlineSeconds?: number
  generation?: number
  status?: DeploymentStatus
}

export const createDeployment = (config: DeploymentConfig): Deployment => {
  const initialGeneration = config.generation ?? 1
  const initialStatus = config.status ?? {
    replicas: 0,
    readyReplicas: 0,
    availableReplicas: 0,
    updatedReplicas: 0,
    observedGeneration: initialGeneration
  }
  const deployment: Deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp: config.creationTimestamp || new Date().toISOString(),
      generation: initialGeneration,
      ...(config.labels && { labels: config.labels }),
      ...(config.annotations && { annotations: config.annotations })
    },
    spec: {
      replicas: config.replicas ?? 1,
      selector: config.selector,
      template: config.template,
      ...(config.strategy && { strategy: config.strategy }),
      ...(config.minReadySeconds != null && {
        minReadySeconds: config.minReadySeconds
      }),
      ...(config.revisionHistoryLimit != null && {
        revisionHistoryLimit: config.revisionHistoryLimit
      }),
      ...(config.paused != null && {
        paused: config.paused
      }),
      ...(config.progressDeadlineSeconds != null && {
        progressDeadlineSeconds: config.progressDeadlineSeconds
      })
    },
    status: initialStatus
  }

  return deepFreeze(deployment)
}

// ─── Zod Schema for YAML Validation ───────────────────────────────────────

const LabelSelectorSchema = z.object({
  matchLabels: z.record(z.string(), z.string()).optional(),
  matchExpressions: z
    .array(
      z.object({
        key: z.string(),
        operator: z.enum(['In', 'NotIn', 'Exists', 'DoesNotExist']),
        values: z.array(z.string()).optional()
      })
    )
    .optional()
})

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
          cpu: z.string().optional(),
          memory: z.string().optional()
        })
        .optional(),
      limits: z
        .object({
          cpu: z.string().optional(),
          memory: z.string().optional()
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

const PodTemplateSpecSchema = z.object({
  metadata: z
    .object({
      labels: z.record(z.string(), z.string()).optional(),
      annotations: z.record(z.string(), z.string()).optional()
    })
    .optional(),
  spec: z.object({
    nodeSelector: z.record(z.string(), z.string()).optional(),
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
    containers: z
      .array(ContainerSchema)
      .min(1, 'At least one container is required'),
    initContainers: z.array(ContainerSchema).optional(),
    volumes: z.array(z.any()).optional()
  })
})

const DeploymentStrategySchema = z
  .object({
    type: z.enum(['Recreate', 'RollingUpdate']).optional(),
    rollingUpdate: z
      .object({
        maxUnavailable: z.union([z.number(), z.string()]).optional(),
        maxSurge: z.union([z.number(), z.string()]).optional()
      })
      .optional()
  })
  .optional()

const DeploymentManifestSchema = z.object({
  apiVersion: z.literal('apps/v1'),
  kind: z.literal('Deployment'),
  metadata: z.object({
    name: z.string().min(1, 'Deployment name is required'),
    namespace: z.string().default('default'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  spec: z.object({
    replicas: z.number().int().min(0).optional(),
    selector: LabelSelectorSchema,
    template: PodTemplateSpecSchema,
    strategy: DeploymentStrategySchema,
    minReadySeconds: z.number().int().min(0).optional(),
    revisionHistoryLimit: z.number().int().min(0).optional(),
    paused: z.boolean().optional(),
    progressDeadlineSeconds: z.number().int().min(0).optional()
  })
})

/**
 * Parse and validate Deployment manifest from YAML
 */
export const parseDeploymentManifest = (data: unknown): Result<Deployment> => {
  const result = DeploymentManifestSchema.safeParse(data)

  if (!result.success) {
    const firstError = result.error.issues[0]
    return error(
      `Invalid Deployment manifest: ${firstError.path.join('.')}: ${firstError.message}`
    )
  }

  const manifest = result.data

  const deployment = createDeployment({
    name: manifest.metadata.name,
    namespace: manifest.metadata.namespace,
    replicas: manifest.spec.replicas,
    selector: manifest.spec.selector,
    template: manifest.spec.template as PodTemplateSpec,
    strategy: manifest.spec.strategy as DeploymentStrategy | undefined,
    ...(manifest.spec.minReadySeconds != null && {
      minReadySeconds: manifest.spec.minReadySeconds
    }),
    ...(manifest.spec.revisionHistoryLimit != null && {
      revisionHistoryLimit: manifest.spec.revisionHistoryLimit
    }),
    ...(manifest.spec.paused != null && {
      paused: manifest.spec.paused
    }),
    ...(manifest.spec.progressDeadlineSeconds != null && {
      progressDeadlineSeconds: manifest.spec.progressDeadlineSeconds
    }),
    ...(manifest.metadata.labels && { labels: manifest.metadata.labels }),
    ...(manifest.metadata.annotations && {
      annotations: manifest.metadata.annotations
    }),
    ...(manifest.metadata.creationTimestamp && {
      creationTimestamp: manifest.metadata.creationTimestamp
    }),
    generation: 1
  })

  return success(deployment)
}

// ─── Helper Functions ─────────────────────────────────────────────────────

/**
 * Get desired replicas count
 */
export const getDeploymentDesiredReplicas = (
  deployment: Deployment
): number => {
  return deployment.spec.replicas ?? 1
}

/**
 * Get ready/desired replicas display string (e.g., "3/3")
 */
export const getDeploymentReadyDisplay = (deployment: Deployment): string => {
  const desired = deployment.spec.replicas ?? 1
  const ready = deployment.status.readyReplicas ?? 0
  return `${ready}/${desired}`
}

/**
 * Check if deployment is available
 */
export const isDeploymentAvailable = (deployment: Deployment): boolean => {
  const condition = deployment.status.conditions?.find(
    (c) => c.type === 'Available'
  )
  return condition?.status === 'True'
}

/**
 * Generate ReplicaSet name from Deployment
 */
export const generateReplicaSetName = (
  deploymentName: string,
  templateHash: string
): string => {
  return `${deploymentName}-${templateHash}`
}

/**
 * Generate simple template hash (simplified version)
 */
export const generateTemplateHash = (template: PodTemplateSpec): string => {
  const canonicalTemplate = canonicalizeTemplateForHash(template)
  const serializedTemplate = JSON.stringify(canonicalTemplate)
  let hash = 0
  for (let i = 0; i < serializedTemplate.length; i++) {
    const char = serializedTemplate.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  // Convert to hex and take last 10 chars
  return Math.abs(hash).toString(16).slice(-10).padStart(10, '0')
}

const canonicalizeTemplateForHash = (template: PodTemplateSpec): unknown => {
  const metadata = template.metadata ?? {}
  const labels = metadata.labels ?? {}
  const filteredLabels = Object.fromEntries(
    Object.entries(labels).filter(([key]) => key !== 'pod-template-hash')
  )

  const normalizedTemplate: PodTemplateSpec = {
    ...template,
    ...(template.metadata && {
      metadata: {
        ...metadata,
        ...(metadata.labels && {
          labels: filteredLabels
        })
      }
    })
  }

  return canonicalizeHashValue(normalizedTemplate)
}

const canonicalizeHashValue = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeHashValue(item))
  }
  if (value !== null && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>
    const sortedEntries = Object.entries(objectValue)
      .filter(([, entryValue]) => entryValue !== undefined)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(
        ([key, entryValue]) => [key, canonicalizeHashValue(entryValue)] as const
      )
    return Object.fromEntries(sortedEntries)
  }

  return value
}
