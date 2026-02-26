// ═══════════════════════════════════════════════════════════════════════════
// REPLICASET MODEL
// ═══════════════════════════════════════════════════════════════════════════
// Kubernetes ReplicaSet resource for managing Pod replicas
// Based on apps/v1 API spec

import { z } from 'zod'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { KubernetesResource } from '../repositories/types'
import type { OwnerReference, PodToleration } from './Pod'
import type { EnvVar, Probe, Volume, VolumeMount } from './Pod'

// ─── Label Selector ───────────────────────────────────────────────────────

export interface LabelSelector {
  matchLabels?: Record<string, string>
  matchExpressions?: LabelSelectorRequirement[]
}

export interface LabelSelectorRequirement {
  key: string
  operator: 'In' | 'NotIn' | 'Exists' | 'DoesNotExist'
  values?: string[]
}

// ─── Pod Template Spec ────────────────────────────────────────────────────
// Simplified version - we reuse the container types from Pod

export interface PodTemplateSpec {
  metadata?: {
    labels?: Record<string, string>
    annotations?: Record<string, string>
  }
  spec: {
    nodeSelector?: Record<string, string>
    tolerations?: PodToleration[]
    containers: Array<{
      name: string
      image: string
      command?: string[]
      args?: string[]
      ports?: Array<{
        containerPort: number
        protocol?: 'TCP' | 'UDP'
      }>
      resources?: {
        requests?: {
          cpu?: string
          memory?: string
        }
        limits?: {
          cpu?: string
          memory?: string
        }
      }
      env?: EnvVar[]
      volumeMounts?: VolumeMount[]
      livenessProbe?: Probe
      readinessProbe?: Probe
      startupProbe?: Probe
    }>
    initContainers?: Array<{
      name: string
      image: string
      command?: string[]
      args?: string[]
      resources?: {
        requests?: {
          cpu?: string
          memory?: string
        }
        limits?: {
          cpu?: string
          memory?: string
        }
      }
      env?: EnvVar[]
      volumeMounts?: VolumeMount[]
      livenessProbe?: Probe
      readinessProbe?: Probe
      startupProbe?: Probe
    }>
    volumes?: Volume[]
  }
}

// ─── ReplicaSet Spec ──────────────────────────────────────────────────────

export interface ReplicaSetSpec {
  replicas?: number
  minReadySeconds?: number
  selector: LabelSelector
  template: PodTemplateSpec
}

// ─── ReplicaSet Status ────────────────────────────────────────────────────

export interface ReplicaSetCondition {
  type: 'ReplicaFailure'
  status: 'True' | 'False' | 'Unknown'
  lastTransitionTime?: string
  reason?: string
  message?: string
}

export interface ReplicaSetStatus {
  replicas: number
  fullyLabeledReplicas?: number
  readyReplicas?: number
  availableReplicas?: number
  observedGeneration?: number
  conditions?: ReplicaSetCondition[]
}

// ─── ReplicaSet Metadata ──────────────────────────────────────────────────

interface ReplicaSetMetadata {
  name: string
  namespace: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp: string
  ownerReferences?: OwnerReference[]
}

// ─── ReplicaSet Resource ──────────────────────────────────────────────────

export interface ReplicaSet extends KubernetesResource {
  apiVersion: 'apps/v1'
  kind: 'ReplicaSet'
  metadata: ReplicaSetMetadata
  spec: ReplicaSetSpec
  status: ReplicaSetStatus
}

// ─── Factory ──────────────────────────────────────────────────────────────

interface ReplicaSetConfig {
  name: string
  namespace: string
  replicas?: number
  selector: LabelSelector
  template: PodTemplateSpec
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp?: string
  ownerReferences?: OwnerReference[]
}

export const createReplicaSet = (config: ReplicaSetConfig): ReplicaSet => {
  const replicaSet: ReplicaSet = {
    apiVersion: 'apps/v1',
    kind: 'ReplicaSet',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp: config.creationTimestamp || new Date().toISOString(),
      ...(config.labels && { labels: config.labels }),
      ...(config.annotations && { annotations: config.annotations }),
      ...(config.ownerReferences && { ownerReferences: config.ownerReferences })
    },
    spec: {
      replicas: config.replicas ?? 1,
      selector: config.selector,
      template: config.template
    },
    status: {
      replicas: 0,
      readyReplicas: 0,
      availableReplicas: 0
    }
  }

  return deepFreeze(replicaSet)
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
          effect: z.enum(['NoSchedule', 'PreferNoSchedule', 'NoExecute']).optional()
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

const ReplicaSetManifestSchema = z.object({
  apiVersion: z.literal('apps/v1'),
  kind: z.literal('ReplicaSet'),
  metadata: z.object({
    name: z.string().min(1, 'ReplicaSet name is required'),
    namespace: z.string().default('default'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  spec: z.object({
    replicas: z.number().int().min(0).optional(),
    minReadySeconds: z.number().int().min(0).optional(),
    selector: LabelSelectorSchema,
    template: PodTemplateSpecSchema
  })
})

/**
 * Parse and validate ReplicaSet manifest from YAML
 */
export const parseReplicaSetManifest = (data: unknown): Result<ReplicaSet> => {
  const result = ReplicaSetManifestSchema.safeParse(data)

  if (!result.success) {
    const firstError = result.error.issues[0]
    return error(
      `Invalid ReplicaSet manifest: ${firstError.path.join('.')}: ${firstError.message}`
    )
  }

  const manifest = result.data

  const replicaSet = createReplicaSet({
    name: manifest.metadata.name,
    namespace: manifest.metadata.namespace,
    replicas: manifest.spec.replicas,
    selector: manifest.spec.selector,
    template: manifest.spec.template as PodTemplateSpec,
    ...(manifest.metadata.labels && { labels: manifest.metadata.labels }),
    ...(manifest.metadata.annotations && {
      annotations: manifest.metadata.annotations
    }),
    ...(manifest.metadata.creationTimestamp && {
      creationTimestamp: manifest.metadata.creationTimestamp
    })
  })

  return success(replicaSet)
}

// ─── Helper Functions ─────────────────────────────────────────────────────

/**
 * Get desired replicas count
 */
export const getReplicaSetDesiredReplicas = (rs: ReplicaSet): number => {
  return rs.spec.replicas ?? 1
}

/**
 * Get current/ready replicas display string (e.g., "3/3")
 */
export const getReplicaSetReadyDisplay = (rs: ReplicaSet): string => {
  const desired = rs.spec.replicas ?? 1
  const ready = rs.status.readyReplicas ?? 0
  return `${ready}/${desired}`
}

const matchExprByOperator: Record<
  LabelSelectorRequirement['operator'],
  (expr: LabelSelectorRequirement, lbl: Record<string, string>) => boolean
> = {
  In: (expr, lbl) => expr.values?.includes(lbl[expr.key]) ?? false,
  NotIn: (expr, lbl) => !(expr.values?.includes(lbl[expr.key]) ?? false),
  Exists: (expr, lbl) => expr.key in lbl,
  DoesNotExist: (expr, lbl) => !(expr.key in lbl)
}

/**
 * Check if selector matches pod labels
 */
export const selectorMatchesLabels = (
  selector: LabelSelector,
  labels: Record<string, string> | undefined
): boolean => {
  if (!labels) {
    return false
  }

  // Check matchLabels
  if (selector.matchLabels) {
    for (const [key, value] of Object.entries(selector.matchLabels)) {
      if (labels[key] !== value) {
        return false
      }
    }
  }

  // Check matchExpressions (simplified)
  if (selector.matchExpressions) {
    for (const expr of selector.matchExpressions) {
      if (!matchExprByOperator[expr.operator](expr, labels)) {
        return false
      }
    }
  }

  return true
}
