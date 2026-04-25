// ═══════════════════════════════════════════════════════════════════════════
// REPLICASET MODEL
// ═══════════════════════════════════════════════════════════════════════════
// Kubernetes ReplicaSet resource for managing Pod replicas
// Based on apps/v1 API spec

import { z } from 'zod'
import type { components } from '../../openapi/generated/openapi-types.generated'
import type {
  K8sReplicaSet,
  K8sReplicaSetMetadata,
  K8sReplicaSetSpec,
  K8sReplicaSetStatus
} from '../../openapi/generated/k8sOpenapiAliases.generated'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { OwnerReference, PodAffinity, PodToleration } from './Pod'
import type { NamespacedFactoryConfigBase } from './resourceFactoryConfig'
import type { EnvVar, Probe, Volume, VolumeMount } from './Pod'

type IoSchemas = components['schemas']

// ─── Label Selector (OpenAPI meta v1) ─────────────────────────────────────

export type LabelSelector =
  IoSchemas['io.k8s.apimachinery.pkg.apis.meta.v1.LabelSelector']

export type LabelSelectorRequirement =
  IoSchemas['io.k8s.apimachinery.pkg.apis.meta.v1.LabelSelectorRequirement']

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
    affinity?: PodAffinity
    dnsPolicy?: 'ClusterFirst' | 'Default'
    enableServiceLinks?: boolean
    preemptionPolicy?: 'PreemptLowerPriority' | 'Never'
    priority?: number
    priorityClassName?: string
    restartPolicy?: 'Always' | 'OnFailure' | 'Never'
    schedulerName?: string
    securityContext?: Record<string, unknown>
    serviceAccount?: string
    serviceAccountName?: string
    terminationGracePeriodSeconds?: number
    containers: Array<{
      name: string
      image: string
      imagePullPolicy?: string
      command?: string[]
      args?: string[]
      ports?: Array<{
        containerPort: number
        name?: string
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
      livenessProbe?: Probe | Record<string, unknown>
      readinessProbe?: Probe | Record<string, unknown>
      startupProbe?: Probe | Record<string, unknown>
      securityContext?: Record<string, unknown>
      terminationMessagePath?: string
      terminationMessagePolicy?: string
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

export type ReplicaSetSpec = Omit<
  Pick<
    K8sReplicaSetSpec,
    'replicas' | 'minReadySeconds' | 'selector' | 'template'
  >,
  'template'
> & {
  template: PodTemplateSpec
}

// ─── ReplicaSet Status ────────────────────────────────────────────────────

export type ReplicaSetCondition =
  IoSchemas['io.k8s.api.apps.v1.ReplicaSetCondition']

export type ReplicaSetStatus = Pick<
  K8sReplicaSetStatus,
  | 'replicas'
  | 'fullyLabeledReplicas'
  | 'readyReplicas'
  | 'availableReplicas'
  | 'observedGeneration'
  | 'conditions'
>

// ─── ReplicaSet Metadata ──────────────────────────────────────────────────

type ReplicaSetMetadata = Pick<
  K8sReplicaSetMetadata,
  | 'name'
  | 'namespace'
  | 'labels'
  | 'annotations'
  | 'creationTimestamp'
  | 'ownerReferences'
>

// ─── ReplicaSet Resource ──────────────────────────────────────────────────

export type ReplicaSet = Omit<K8sReplicaSet, 'metadata' | 'spec' | 'status'> & {
  metadata: ReplicaSetMetadata
  spec: ReplicaSetSpec
  status: ReplicaSetStatus
}

// ─── Factory ──────────────────────────────────────────────────────────────

interface ReplicaSetConfig extends NamespacedFactoryConfigBase {
  replicas?: number
  selector: LabelSelector
  template: PodTemplateSpec
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

const LabelSelectorRequirementSchema = z
  .object({
    key: z.string(),
    operator: z.enum(['In', 'NotIn', 'Exists', 'DoesNotExist']),
    values: z.array(z.string()).optional()
  })
  .superRefine((selectorRequirement, context) => {
    const valuesCount = selectorRequirement.values?.length ?? 0
    const operatorRequiresValues =
      selectorRequirement.operator === 'In' ||
      selectorRequirement.operator === 'NotIn'
    if (operatorRequiresValues && valuesCount === 0) {
      context.addIssue({
        code: 'custom',
        path: ['values'],
        message: "must be specified when `operator` is 'In' or 'NotIn'"
      })
    }

    const operatorForbidsValues =
      selectorRequirement.operator === 'Exists' ||
      selectorRequirement.operator === 'DoesNotExist'
    if (operatorForbidsValues && valuesCount > 0) {
      context.addIssue({
        code: 'custom',
        path: ['values'],
        message:
          "may not be specified when `operator` is 'Exists' or 'DoesNotExist'"
      })
    }
  })

const LabelSelectorSchema = z.object({
  matchLabels: z.record(z.string(), z.string()).optional(),
  matchExpressions: z.array(LabelSelectorRequirementSchema).optional()
})

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
  startupProbe: z.any().optional(),
  securityContext: z.any().optional(),
  terminationMessagePath: z.string().optional(),
  terminationMessagePolicy: z.string().optional()
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
    affinity: z.any().optional(),
    dnsPolicy: z.enum(['ClusterFirst', 'Default']).optional(),
    priorityClassName: z.string().optional(),
    restartPolicy: z.enum(['Always', 'OnFailure', 'Never']).optional(),
    schedulerName: z.string().optional(),
    securityContext: z.any().optional(),
    serviceAccount: z.string().optional(),
    serviceAccountName: z.string().optional(),
    terminationGracePeriodSeconds: z.number().int().min(0).optional(),
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
  const templateLabels = manifest.spec.template.metadata?.labels
  const selectorMatchesTemplateLabels = selectorMatchesLabels(
    manifest.spec.selector,
    templateLabels
  )
  if (!selectorMatchesTemplateLabels) {
    return error(
      `The ReplicaSet "${manifest.metadata.name}" is invalid: spec.template.metadata.labels: Invalid value: ${JSON.stringify(templateLabels ?? {})}: \`selector\` does not match template \`labels\``
    )
  }

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
  string,
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
      const matchExpression = matchExprByOperator[expr.operator]
      if (matchExpression == null || !matchExpression(expr, labels)) {
        return false
      }
    }
  }

  return true
}
