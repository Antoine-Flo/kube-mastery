// ═══════════════════════════════════════════════════════════════════════════
// DAEMONSET MODEL
// ═══════════════════════════════════════════════════════════════════════════
// Kubernetes DaemonSet resource for node-scoped Pod management (apps/v1)

import { z } from 'zod'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { KubernetesResource } from '../repositories/types'
import type { LabelSelector, PodTemplateSpec } from './ReplicaSet'

export interface DaemonSetSpec {
  selector: LabelSelector
  template: PodTemplateSpec
}

export interface DaemonSetStatus {
  currentNumberScheduled: number
  desiredNumberScheduled: number
  numberReady: number
}

interface DaemonSetMetadata {
  name: string
  namespace: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp: string
}

export interface DaemonSet extends KubernetesResource {
  apiVersion: 'apps/v1'
  kind: 'DaemonSet'
  metadata: DaemonSetMetadata
  spec: DaemonSetSpec
  status: DaemonSetStatus
}

interface DaemonSetConfig {
  name: string
  namespace: string
  selector: LabelSelector
  template: PodTemplateSpec
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp?: string
}

export const createDaemonSet = (config: DaemonSetConfig): DaemonSet => {
  const daemonSet: DaemonSet = {
    apiVersion: 'apps/v1',
    kind: 'DaemonSet',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp: config.creationTimestamp || new Date().toISOString(),
      ...(config.labels && { labels: config.labels }),
      ...(config.annotations && { annotations: config.annotations })
    },
    spec: {
      selector: config.selector,
      template: config.template
    },
    status: {
      currentNumberScheduled: 0,
      desiredNumberScheduled: 0,
      numberReady: 0
    }
  }

  return deepFreeze(daemonSet)
}

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

const DaemonSetManifestSchema = z.object({
  apiVersion: z.literal('apps/v1'),
  kind: z.literal('DaemonSet'),
  metadata: z.object({
    name: z.string().min(1, 'DaemonSet name is required'),
    namespace: z.string().default('default'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  spec: z.object({
    selector: LabelSelectorSchema,
    template: PodTemplateSpecSchema
  })
})

export const parseDaemonSetManifest = (data: unknown): Result<DaemonSet> => {
  const result = DaemonSetManifestSchema.safeParse(data)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return error(
      `Invalid DaemonSet manifest: ${firstError.path.join('.')}: ${firstError.message}`
    )
  }

  const manifest = result.data
  const daemonSet = createDaemonSet({
    name: manifest.metadata.name,
    namespace: manifest.metadata.namespace,
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

  return success(daemonSet)
}
