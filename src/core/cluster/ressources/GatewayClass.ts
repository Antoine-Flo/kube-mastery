import { z } from 'zod'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { KubernetesResource } from '../repositories/types'
import type { ClusterScopedNameFactoryConfigBase } from './resourceFactoryConfig'

interface GatewayClassMetadata {
  name: string
  namespace: ''
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp: string
}

export interface GatewayClassCondition {
  type: string
  status: 'True' | 'False' | 'Unknown'
  reason?: string
  message?: string
  observedGeneration?: number
  lastTransitionTime?: string
}

export interface GatewayClass extends KubernetesResource {
  apiVersion: 'gateway.networking.k8s.io/v1'
  kind: 'GatewayClass'
  metadata: GatewayClassMetadata
  spec: {
    controllerName: string
  }
  status?: {
    conditions?: GatewayClassCondition[]
  }
}

interface GatewayClassConfig extends ClusterScopedNameFactoryConfigBase {
  spec: {
    controllerName: string
  }
  status?: GatewayClass['status']
}

export const createGatewayClass = (config: GatewayClassConfig): GatewayClass => {
  const gatewayClass: GatewayClass = {
    apiVersion: 'gateway.networking.k8s.io/v1',
    kind: 'GatewayClass',
    metadata: {
      name: config.name,
      namespace: '',
      creationTimestamp: config.creationTimestamp ?? new Date().toISOString(),
      ...(config.labels != null ? { labels: config.labels } : {}),
      ...(config.annotations != null ? { annotations: config.annotations } : {})
    },
    spec: config.spec,
    ...(config.status != null ? { status: config.status } : {})
  }
  return deepFreeze(gatewayClass)
}

const GatewayClassManifestSchema = z.object({
  apiVersion: z.literal('gateway.networking.k8s.io/v1'),
  kind: z.literal('GatewayClass'),
  metadata: z.object({
    name: z.string().min(1, 'GatewayClass name is required'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  spec: z.object({
    controllerName: z.string().min(1, 'GatewayClass controllerName is required')
  }),
  status: z
    .object({
      conditions: z
        .array(
          z.object({
            type: z.string().min(1),
            status: z.enum(['True', 'False', 'Unknown']),
            reason: z.string().optional(),
            message: z.string().optional(),
            observedGeneration: z.number().int().optional(),
            lastTransitionTime: z.string().optional()
          })
        )
        .optional()
    })
    .optional()
})

export const parseGatewayClassManifest = (
  data: unknown
): Result<GatewayClass> => {
  const result = GatewayClassManifestSchema.safeParse(data)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return error(
      `Invalid GatewayClass manifest: ${firstError.path.join('.')}: ${firstError.message}`
    )
  }

  const manifest = result.data
  return success(
    createGatewayClass({
      name: manifest.metadata.name,
      spec: manifest.spec,
      ...(manifest.status != null ? { status: manifest.status } : {}),
      ...(manifest.metadata.labels != null
        ? { labels: manifest.metadata.labels }
        : {}),
      ...(manifest.metadata.annotations != null
        ? { annotations: manifest.metadata.annotations }
        : {}),
      ...(manifest.metadata.creationTimestamp != null
        ? { creationTimestamp: manifest.metadata.creationTimestamp }
        : {})
    })
  )
}
