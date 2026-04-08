import { z } from 'zod'
import type {
  K8sIngressClass,
  K8sIngressClassMetadata,
  K8sIngressClassSpec
} from '../../openapi/generated/k8sOpenapiAliases.generated'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { ClusterScopedNameFactoryConfigBase } from './resourceFactoryConfig'

type IngressClassMetadata = Pick<
  K8sIngressClassMetadata,
  'name' | 'namespace' | 'labels' | 'annotations' | 'creationTimestamp'
> & { namespace: '' }

export type IngressClassSpec = K8sIngressClassSpec

export type IngressClass = Omit<K8sIngressClass, 'metadata' | 'spec'> & {
  metadata: IngressClassMetadata
  spec: IngressClassSpec
}

interface IngressClassConfig extends ClusterScopedNameFactoryConfigBase {
  spec: IngressClassSpec
}

export const createIngressClass = (config: IngressClassConfig): IngressClass => {
  const ingressClass: IngressClass = {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'IngressClass',
    metadata: {
      name: config.name,
      namespace: '',
      creationTimestamp: config.creationTimestamp ?? new Date().toISOString(),
      ...(config.labels != null ? { labels: config.labels } : {}),
      ...(config.annotations != null ? { annotations: config.annotations } : {})
    },
    spec: config.spec
  }
  return deepFreeze(ingressClass)
}

const IngressClassManifestSchema = z.object({
  apiVersion: z.literal('networking.k8s.io/v1'),
  kind: z.literal('IngressClass'),
  metadata: z.object({
    name: z.string().min(1, 'IngressClass name is required'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  spec: z.object({
    controller: z.string().min(1, 'IngressClass controller is required'),
    parameters: z
      .object({
        apiGroup: z.string().min(1).optional(),
        kind: z.string().min(1),
        name: z.string().min(1),
        namespace: z.string().min(1).optional(),
        scope: z.enum(['Namespace', 'Cluster']).optional()
      })
      .optional()
  })
})

export const parseIngressClassManifest = (
  data: unknown
): Result<IngressClass> => {
  const result = IngressClassManifestSchema.safeParse(data)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return error(
      `Invalid IngressClass manifest: ${firstError.path.join('.')}: ${firstError.message}`
    )
  }

  const manifest = result.data
  return success(
    createIngressClass({
      name: manifest.metadata.name,
      spec: manifest.spec,
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
