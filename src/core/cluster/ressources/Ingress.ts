import { z } from 'zod'
import type { components } from '../../openapi/generated/openapi-types.generated'
import type {
  K8sIngress,
  K8sIngressMetadata,
  K8sIngressSpec
} from '../../openapi/generated/k8sOpenapiAliases.generated'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { NamespacedFactoryConfigBase } from './resourceFactoryConfig'

type IoSchemas = components['schemas']

export type IngressSpec = K8sIngressSpec

export type IngressRule = IoSchemas['io.k8s.api.networking.v1.IngressRule']
export type IngressTLS = IoSchemas['io.k8s.api.networking.v1.IngressTLS']
export type IngressBackend = IoSchemas['io.k8s.api.networking.v1.IngressBackend']
export type HTTPIngressPath = IoSchemas['io.k8s.api.networking.v1.HTTPIngressPath']

type IngressMetadata = Pick<
  K8sIngressMetadata,
  'name' | 'namespace' | 'labels' | 'annotations' | 'creationTimestamp'
>

export type Ingress = Omit<K8sIngress, 'metadata' | 'spec' | 'status'> & {
  metadata: IngressMetadata
  spec: IngressSpec
}

interface IngressConfig extends NamespacedFactoryConfigBase {
  spec: IngressSpec
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

const IngressBackendServiceSchema = z.object({
  name: z.string().min(1, 'backend service name is required'),
  port: IngressServicePortSchema
})

const IngressPathSchema = z.object({
  path: z.string().min(1, 'path is required'),
  pathType: z.enum(['Exact', 'Prefix', 'ImplementationSpecific']),
  backend: z.object({
    service: IngressBackendServiceSchema
  })
})

const IngressRuleSchema = z.object({
  host: z.string().optional(),
  http: z
    .object({
      paths: z.array(IngressPathSchema).min(1, 'at least one path is required')
    })
    .optional()
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
  spec: z
    .object({
      ingressClassName: z.string().min(1).optional(),
      defaultBackend: z
        .object({
          service: IngressBackendServiceSchema
        })
        .optional(),
      rules: z.array(IngressRuleSchema).optional(),
      tls: z
        .array(
          z.object({
            hosts: z.array(z.string().min(1)).optional(),
            secretName: z.string().min(1).optional()
          })
        )
        .optional()
    })
    .superRefine((spec, ctx) => {
      const hasRules = spec.rules != null && spec.rules.length > 0
      const hasDefault = spec.defaultBackend != null
      if (!hasRules && !hasDefault) {
        ctx.addIssue({
          code: 'custom',
          message:
            'spec must include at least one rule or defaultBackend when rules are omitted',
          path: ['rules']
        })
        return
      }
      if (hasRules) {
        const ruleList = spec.rules
        if (ruleList == null) {
          return
        }
        for (let index = 0; index < ruleList.length; index += 1) {
          const rule = ruleList[index]
          if (rule.http == null) {
            ctx.addIssue({
              code: 'custom',
              message: 'each rule must include http when rules are set',
              path: ['rules', index, 'http']
            })
          }
        }
      }
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
