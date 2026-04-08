import { z } from 'zod'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { KubernetesResource } from '../repositories/types'

interface NetworkPolicyMetadata {
  name: string
  namespace: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp: string
}

/**
 * NetworkPolicy spec (flexible nested shapes from real manifests).
 * Ingress/egress rules keep structured JSON-compatible objects.
 */
export interface NetworkPolicySpec {
  podSelector?: Record<string, unknown>
  policyTypes?: string[]
  ingress?: Record<string, unknown>[]
  egress?: Record<string, unknown>[]
}

export interface NetworkPolicy extends KubernetesResource {
  apiVersion: 'networking.k8s.io/v1'
  kind: 'NetworkPolicy'
  metadata: NetworkPolicyMetadata
  spec: NetworkPolicySpec
}

interface NetworkPolicyConfig {
  name: string
  namespace: string
  spec: NetworkPolicySpec
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp?: string
}

export const createNetworkPolicy = (
  config: NetworkPolicyConfig
): NetworkPolicy => {
  const policy: NetworkPolicy = {
    apiVersion: 'networking.k8s.io/v1',
    kind: 'NetworkPolicy',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp: config.creationTimestamp || new Date().toISOString(),
      ...(config.labels && { labels: config.labels }),
      ...(config.annotations && { annotations: config.annotations })
    },
    spec: config.spec
  }

  return deepFreeze(policy)
}

const PodSelectorSchema = z.object({}).passthrough()

const RuleObjectSchema = z.record(z.string(), z.unknown())

const NetworkPolicyManifestSchema = z.object({
  apiVersion: z.literal('networking.k8s.io/v1'),
  kind: z.literal('NetworkPolicy'),
  metadata: z.object({
    name: z.string().min(1, 'NetworkPolicy name is required'),
    namespace: z.string().default('default'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  spec: z
    .object({
      podSelector: PodSelectorSchema.optional(),
      policyTypes: z.array(z.string()).optional(),
      ingress: z.array(RuleObjectSchema).optional(),
      egress: z.array(RuleObjectSchema).optional()
    })
    .passthrough()
})

export const parseNetworkPolicyManifest = (
  data: unknown
): Result<NetworkPolicy> => {
  const result = NetworkPolicyManifestSchema.safeParse(data)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return error(
      `Invalid NetworkPolicy manifest: ${firstError.path.join('.')}: ${firstError.message}`
    )
  }

  const manifest = result.data
  const spec: NetworkPolicySpec = { ...manifest.spec }
  return success(
    createNetworkPolicy({
      name: manifest.metadata.name,
      namespace: manifest.metadata.namespace,
      spec,
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
