import { z } from 'zod'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { NamespacedFactoryConfigBase } from './resourceFactoryConfig'

export interface ServiceAccount {
  apiVersion: 'v1'
  kind: 'ServiceAccount'
  metadata: {
    name: string
    namespace: string
    labels?: Record<string, string>
    annotations?: Record<string, string>
    creationTimestamp: string
  }
  automountServiceAccountToken?: boolean
  secrets?: Array<{
    name: string
  }>
  imagePullSecrets?: Array<{
    name: string
  }>
}

export interface ServiceAccountConfig extends NamespacedFactoryConfigBase {
  automountServiceAccountToken?: boolean
}

export const createServiceAccount = (
  config: ServiceAccountConfig
): ServiceAccount => {
  const serviceAccount: ServiceAccount = {
    apiVersion: 'v1',
    kind: 'ServiceAccount',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp: config.creationTimestamp ?? new Date().toISOString(),
      ...(config.labels != null ? { labels: config.labels } : {}),
      ...(config.annotations != null ? { annotations: config.annotations } : {})
    },
    ...(config.automountServiceAccountToken != null
      ? {
          automountServiceAccountToken: config.automountServiceAccountToken
        }
      : {})
  }
  return deepFreeze(serviceAccount)
}

const NameRefSchema = z.object({
  name: z.string().min(1)
})

const ServiceAccountManifestSchema = z.object({
  apiVersion: z.literal('v1'),
  kind: z.literal('ServiceAccount'),
  metadata: z.object({
    name: z.string().min(1),
    namespace: z.string().default('default'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  automountServiceAccountToken: z.boolean().optional(),
  secrets: z.array(NameRefSchema).optional(),
  imagePullSecrets: z.array(NameRefSchema).optional()
})

export const parseServiceAccountManifest = (
  manifest: unknown
): Result<ServiceAccount> => {
  const parsed = ServiceAccountManifestSchema.safeParse(manifest)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    return error(
      `Invalid ServiceAccount manifest: ${firstIssue.path.join('.')}: ${firstIssue.message}`
    )
  }
  const base = createServiceAccount({
    name: parsed.data.metadata.name,
    namespace: parsed.data.metadata.namespace,
    labels: parsed.data.metadata.labels,
    annotations: parsed.data.metadata.annotations,
    creationTimestamp: parsed.data.metadata.creationTimestamp,
    automountServiceAccountToken: parsed.data.automountServiceAccountToken
  })
  return success(
    deepFreeze({
      ...base,
      ...(parsed.data.secrets != null ? { secrets: parsed.data.secrets } : {}),
      ...(parsed.data.imagePullSecrets != null
        ? { imagePullSecrets: parsed.data.imagePullSecrets }
        : {})
    })
  )
}
