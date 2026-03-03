import { z } from 'zod'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { KubernetesResource } from '../repositories/types'

interface IngressMetadata {
  name: string
  namespace: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp: string
}

export interface IngressBackendServicePort {
  number?: number
  name?: string
}

export interface IngressBackendService {
  name: string
  port: IngressBackendServicePort
}

export interface IngressPath {
  path: string
  pathType: 'Exact' | 'Prefix' | 'ImplementationSpecific'
  backend: {
    service: IngressBackendService
  }
}

export interface IngressRule {
  host?: string
  http: {
    paths: IngressPath[]
  }
}

export interface IngressSpec {
  ingressClassName?: string
  rules: IngressRule[]
}

export interface Ingress extends KubernetesResource {
  apiVersion: 'networking.k8s.io/v1'
  kind: 'Ingress'
  metadata: IngressMetadata
  spec: IngressSpec
}

interface IngressConfig {
  name: string
  namespace: string
  spec: IngressSpec
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp?: string
}

export const createIngress = (config: IngressConfig): Ingress => {
  const ingress: Ingress = {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'Ingress',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp: config.creationTimestamp || new Date().toISOString(),
      ...(config.labels && { labels: config.labels }),
      ...(config.annotations && { annotations: config.annotations })
    },
    spec: config.spec
  }

  return deepFreeze(ingress)
}

const IngressServicePortSchema = z
  .object({
    number: z.number().int().positive().optional(),
    name: z.string().min(1).optional()
  })
  .refine((value) => value.number !== undefined || value.name !== undefined, {
    message: 'service.port requires either number or name'
  })

const IngressManifestSchema = z.object({
  apiVersion: z.literal('networking.k8s.io/v1'),
  kind: z.literal('Ingress'),
  metadata: z.object({
    name: z.string().min(1, 'Ingress name is required'),
    namespace: z.string().default('default'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  spec: z.object({
    ingressClassName: z.string().min(1).optional(),
    rules: z
      .array(
        z.object({
          host: z.string().optional(),
          http: z.object({
            paths: z
              .array(
                z.object({
                  path: z.string().min(1, 'path is required'),
                  pathType: z.enum([
                    'Exact',
                    'Prefix',
                    'ImplementationSpecific'
                  ]),
                  backend: z.object({
                    service: z.object({
                      name: z
                        .string()
                        .min(1, 'backend service name is required'),
                      port: IngressServicePortSchema
                    })
                  })
                })
              )
              .min(1, 'at least one path is required')
          })
        })
      )
      .min(1, 'at least one rule is required')
  })
})

export const parseIngressManifest = (data: unknown): Result<Ingress> => {
  const result = IngressManifestSchema.safeParse(data)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return error(
      `Invalid Ingress manifest: ${firstError.path.join('.')}: ${firstError.message}`
    )
  }

  const manifest = result.data
  return success(
    createIngress({
      name: manifest.metadata.name,
      namespace: manifest.metadata.namespace,
      spec: manifest.spec,
      ...(manifest.metadata.labels && { labels: manifest.metadata.labels }),
      ...(manifest.metadata.annotations && {
        annotations: manifest.metadata.annotations
      }),
      ...(manifest.metadata.creationTimestamp && {
        creationTimestamp: manifest.metadata.creationTimestamp
      })
    })
  )
}
