import { z } from 'zod'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { KubernetesResource } from '../repositories/types'
import type { LabelSelector, PodTemplateSpec } from './ReplicaSet'

export interface StatefulSetSpec {
  replicas?: number
  selector: LabelSelector
  serviceName?: string
  template: PodTemplateSpec
}

export interface StatefulSetStatus {
  replicas: number
  readyReplicas?: number
  currentReplicas?: number
  updatedReplicas?: number
}

interface StatefulSetMetadata {
  name: string
  namespace: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp: string
  generation?: number
}

export interface StatefulSet extends KubernetesResource {
  apiVersion: 'apps/v1'
  kind: 'StatefulSet'
  metadata: StatefulSetMetadata
  spec: StatefulSetSpec
  status: StatefulSetStatus
}

interface StatefulSetConfig {
  name: string
  namespace: string
  replicas?: number
  selector: LabelSelector
  serviceName?: string
  template: PodTemplateSpec
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp?: string
  generation?: number
}

export const createStatefulSet = (config: StatefulSetConfig): StatefulSet => {
  const statefulSet: StatefulSet = {
    apiVersion: 'apps/v1',
    kind: 'StatefulSet',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp: config.creationTimestamp ?? new Date().toISOString(),
      generation: config.generation ?? 1,
      ...(config.labels != null && { labels: config.labels }),
      ...(config.annotations != null && { annotations: config.annotations })
    },
    spec: {
      replicas: config.replicas ?? 1,
      selector: config.selector,
      template: config.template,
      ...(config.serviceName != null && { serviceName: config.serviceName })
    },
    status: {
      replicas: 0,
      readyReplicas: 0,
      currentReplicas: 0,
      updatedReplicas: 0
    }
  }

  return deepFreeze(statefulSet)
}

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
        code: z.ZodIssueCode.custom,
        path: ['values'],
        message: "must be specified when `operator` is 'In' or 'NotIn'"
      })
    }

    const operatorForbidsValues =
      selectorRequirement.operator === 'Exists' ||
      selectorRequirement.operator === 'DoesNotExist'
    if (operatorForbidsValues && valuesCount > 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
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

const StatefulSetManifestSchema = z.object({
  apiVersion: z.literal('apps/v1'),
  kind: z.literal('StatefulSet'),
  metadata: z.object({
    name: z.string().min(1, 'StatefulSet name is required'),
    namespace: z.string().default('default'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  spec: z.object({
    replicas: z.number().int().min(0).optional(),
    selector: LabelSelectorSchema,
    serviceName: z.string().optional(),
    template: PodTemplateSpecSchema
  })
})

export const parseStatefulSetManifest = (
  data: unknown
): Result<StatefulSet> => {
  const result = StatefulSetManifestSchema.safeParse(data)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return error(
      `Invalid StatefulSet manifest: ${firstError.path.join('.')}: ${firstError.message}`
    )
  }

  const manifest = result.data
  const statefulSet = createStatefulSet({
    name: manifest.metadata.name,
    namespace: manifest.metadata.namespace,
    replicas: manifest.spec.replicas,
    selector: manifest.spec.selector,
    serviceName: manifest.spec.serviceName,
    template: manifest.spec.template as PodTemplateSpec,
    ...(manifest.metadata.labels != null && {
      labels: manifest.metadata.labels
    }),
    ...(manifest.metadata.annotations != null && {
      annotations: manifest.metadata.annotations
    }),
    ...(manifest.metadata.creationTimestamp != null && {
      creationTimestamp: manifest.metadata.creationTimestamp
    })
  })

  return success(statefulSet)
}
