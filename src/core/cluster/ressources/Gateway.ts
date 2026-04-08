import { z } from 'zod'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { KubernetesResource } from '../repositories/types'
import type { NamespacedFactoryConfigBase } from './resourceFactoryConfig'

interface GatewayMetadata {
  name: string
  namespace: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp: string
}

export interface GatewayListener {
  name: string
  protocol: string
  port: number
  hostname?: string
}

export interface GatewayAddress {
  type?: string
  value: string
}

export interface GatewayCondition {
  type: string
  status: 'True' | 'False' | 'Unknown'
  reason?: string
  message?: string
  observedGeneration?: number
  lastTransitionTime?: string
}

export interface Gateway extends KubernetesResource {
  apiVersion: 'gateway.networking.k8s.io/v1'
  kind: 'Gateway'
  metadata: GatewayMetadata
  spec: {
    gatewayClassName: string
    listeners?: GatewayListener[]
  }
  status?: {
    addresses?: GatewayAddress[]
    conditions?: GatewayCondition[]
  }
}

interface GatewayConfig extends NamespacedFactoryConfigBase {
  spec: Gateway['spec']
  status?: Gateway['status']
}

export const createGateway = (config: GatewayConfig): Gateway => {
  const gateway: Gateway = {
    apiVersion: 'gateway.networking.k8s.io/v1',
    kind: 'Gateway',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp: config.creationTimestamp ?? new Date().toISOString(),
      ...(config.labels != null ? { labels: config.labels } : {}),
      ...(config.annotations != null ? { annotations: config.annotations } : {})
    },
    spec: config.spec,
    ...(config.status != null ? { status: config.status } : {})
  }
  return deepFreeze(gateway)
}

const GatewayManifestSchema = z.object({
  apiVersion: z.literal('gateway.networking.k8s.io/v1'),
  kind: z.literal('Gateway'),
  metadata: z.object({
    name: z.string().min(1, 'Gateway name is required'),
    namespace: z.string().default('default'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  spec: z.object({
    gatewayClassName: z.string().min(1, 'Gateway spec.gatewayClassName is required'),
    listeners: z
      .array(
        z.object({
          name: z.string().min(1),
          protocol: z.string().min(1),
          port: z.number().int().positive(),
          hostname: z.string().min(1).optional()
        })
      )
      .optional()
  }),
  status: z
    .object({
      addresses: z
        .array(
          z.object({
            type: z.string().min(1).optional(),
            value: z.string().min(1)
          })
        )
        .optional(),
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

export const parseGatewayManifest = (data: unknown): Result<Gateway> => {
  const result = GatewayManifestSchema.safeParse(data)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return error(
      `Invalid Gateway manifest: ${firstError.path.join('.')}: ${firstError.message}`
    )
  }

  const manifest = result.data
  return success(
    createGateway({
      name: manifest.metadata.name,
      namespace: manifest.metadata.namespace,
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
