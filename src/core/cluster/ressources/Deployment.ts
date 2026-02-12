// ═══════════════════════════════════════════════════════════════════════════
// DEPLOYMENT MODEL
// ═══════════════════════════════════════════════════════════════════════════
// Kubernetes Deployment resource for declarative Pod and ReplicaSet management
// Based on apps/v1 API spec

import { z } from 'zod'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { KubernetesResource } from '../repositories/types'
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

export interface DeploymentSpec {
  replicas?: number
  selector: LabelSelector
  template: PodTemplateSpec
  strategy?: DeploymentStrategy
  minReadySeconds?: number
  revisionHistoryLimit?: number
  paused?: boolean
  progressDeadlineSeconds?: number
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

export interface DeploymentStatus {
  observedGeneration?: number
  replicas?: number
  updatedReplicas?: number
  readyReplicas?: number
  availableReplicas?: number
  unavailableReplicas?: number
  conditions?: DeploymentCondition[]
  collisionCount?: number
}

// ─── Deployment Metadata ──────────────────────────────────────────────────

interface DeploymentMetadata {
  name: string
  namespace: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp: string
}

// ─── Deployment Resource ──────────────────────────────────────────────────

export interface Deployment extends KubernetesResource {
  apiVersion: 'apps/v1'
  kind: 'Deployment'
  metadata: DeploymentMetadata
  spec: DeploymentSpec
  status: DeploymentStatus
}

// ─── Factory ──────────────────────────────────────────────────────────────

interface DeploymentConfig {
  name: string
  namespace: string
  replicas?: number
  selector: LabelSelector
  template: PodTemplateSpec
  strategy?: DeploymentStrategy
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp?: string
}

export const createDeployment = (config: DeploymentConfig): Deployment => {
  const deployment: Deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp: config.creationTimestamp || new Date().toISOString(),
      ...(config.labels && { labels: config.labels }),
      ...(config.annotations && { annotations: config.annotations })
    },
    spec: {
      replicas: config.replicas ?? 1,
      selector: config.selector,
      template: config.template,
      ...(config.strategy && { strategy: config.strategy })
    },
    status: {
      replicas: 0,
      readyReplicas: 0,
      availableReplicas: 0,
      updatedReplicas: 0
    }
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
  env: z.array(z.any()).optional()
})

const PodTemplateSpecSchema = z.object({
  metadata: z
    .object({
      labels: z.record(z.string(), z.string()).optional(),
      annotations: z.record(z.string(), z.string()).optional()
    })
    .optional(),
  spec: z.object({
    containers: z
      .array(ContainerSchema)
      .min(1, 'At least one container is required'),
    initContainers: z.array(ContainerSchema).optional()
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
    ...(manifest.metadata.labels && { labels: manifest.metadata.labels }),
    ...(manifest.metadata.annotations && {
      annotations: manifest.metadata.annotations
    }),
    ...(manifest.metadata.creationTimestamp && {
      creationTimestamp: manifest.metadata.creationTimestamp
    })
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
  // Simple hash based on container images
  const images = template.spec.containers
    .map((c) => c.image)
    .sort()
    .join(',')
  let hash = 0
  for (let i = 0; i < images.length; i++) {
    const char = images.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // Convert to 32bit integer
  }
  // Convert to hex and take last 10 chars
  return Math.abs(hash).toString(16).slice(-10).padStart(10, '0')
}
