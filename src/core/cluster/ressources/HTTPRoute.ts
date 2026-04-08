import { z } from 'zod'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { KubernetesResource } from '../repositories/types'
import type { NamespacedFactoryConfigBase } from './resourceFactoryConfig'

interface HTTPRouteMetadata {
  name: string
  namespace: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp: string
}

export interface HTTPRouteParentRef {
  name: string
  namespace?: string
  sectionName?: string
}

export interface HTTPRouteRule {
  backendRefs?: Array<{
    name: string
    port?: number
    namespace?: string
  }>
}

export interface HTTPRouteCondition {
  type: string
  status: 'True' | 'False' | 'Unknown'
  reason?: string
  message?: string
  observedGeneration?: number
  lastTransitionTime?: string
}

export interface HTTPRoute extends KubernetesResource {
  apiVersion: 'gateway.networking.k8s.io/v1'
  kind: 'HTTPRoute'
  metadata: HTTPRouteMetadata
  spec: {
    hostnames?: string[]
    parentRefs?: HTTPRouteParentRef[]
    rules?: HTTPRouteRule[]
  }
  status?: {
    parents?: Array<{
      parentRef: HTTPRouteParentRef
      conditions?: HTTPRouteCondition[]
    }>
  }
}

interface HTTPRouteConfig extends NamespacedFactoryConfigBase {
  spec: HTTPRoute['spec']
  status?: HTTPRoute['status']
}

export const createHTTPRoute = (config: HTTPRouteConfig): HTTPRoute => {
  const httpRoute: HTTPRoute = {
    apiVersion: 'gateway.networking.k8s.io/v1',
    kind: 'HTTPRoute',
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
  return deepFreeze(httpRoute)
}

const HTTPRouteManifestSchema = z.object({
  apiVersion: z.literal('gateway.networking.k8s.io/v1'),
  kind: z.literal('HTTPRoute'),
  metadata: z.object({
    name: z.string().min(1, 'HTTPRoute name is required'),
    namespace: z.string().default('default'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  spec: z.object({
    hostnames: z.array(z.string().min(1)).optional(),
    parentRefs: z
      .array(
        z.object({
          name: z.string().min(1),
          namespace: z.string().min(1).optional(),
          sectionName: z.string().min(1).optional()
        })
      )
      .optional(),
    rules: z
      .array(
        z.object({
          backendRefs: z
            .array(
              z.object({
                name: z.string().min(1),
                port: z.number().int().positive().optional(),
                namespace: z.string().min(1).optional()
              })
            )
            .optional()
        })
      )
      .optional()
  }),
  status: z
    .object({
      parents: z
        .array(
          z.object({
            parentRef: z.object({
              name: z.string().min(1),
              namespace: z.string().min(1).optional(),
              sectionName: z.string().min(1).optional()
            }),
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
        )
        .optional()
    })
    .optional()
})

export const parseHTTPRouteManifest = (data: unknown): Result<HTTPRoute> => {
  const result = HTTPRouteManifestSchema.safeParse(data)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return error(
      `Invalid HTTPRoute manifest: ${firstError.path.join('.')}: ${firstError.message}`
    )
  }

  const manifest = result.data
  return success(
    createHTTPRoute({
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
