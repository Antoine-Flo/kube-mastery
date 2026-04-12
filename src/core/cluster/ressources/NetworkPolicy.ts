import { z } from 'zod'
import type {
  K8sNetworkPolicy,
  K8sNetworkPolicyMetadata,
  K8sNetworkPolicySpec
} from '../../openapi/generated/k8sOpenapiAliases.generated'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { NamespacedFactoryConfigBase } from './resourceFactoryConfig'

type NetworkPolicyMetadata = Pick<
  K8sNetworkPolicyMetadata,
  'name' | 'namespace' | 'labels' | 'annotations' | 'creationTimestamp'
>

/** Persisted spec matches networking.k8s.io v1 OpenAPI. */
export type NetworkPolicySpec = K8sNetworkPolicySpec

/**
 * Factory / YAML parse input: podSelector defaults to {} when omitted (Kubernetes behavior).
 */
export type NetworkPolicySpecInput = Omit<K8sNetworkPolicySpec, 'podSelector'> & {
  podSelector?: K8sNetworkPolicySpec['podSelector']
}

export const normalizeNetworkPolicySpec = (
  spec: NetworkPolicySpecInput
): NetworkPolicySpec => {
  return {
    ...spec,
    podSelector: spec.podSelector ?? {}
  }
}

export type NetworkPolicy = Omit<K8sNetworkPolicy, 'metadata' | 'spec'> & {
  metadata: NetworkPolicyMetadata
  spec: NetworkPolicySpec
}

interface NetworkPolicyConfig extends NamespacedFactoryConfigBase {
  spec: NetworkPolicySpecInput
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
    spec: normalizeNetworkPolicySpec(config.spec)
  }

  return deepFreeze(policy)
}

const PodSelectorSchema = z.looseObject({})

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
  spec: z.looseObject({
    podSelector: PodSelectorSchema.optional(),
    policyTypes: z.array(z.string()).optional(),
    ingress: z.array(RuleObjectSchema).optional(),
    egress: z.array(RuleObjectSchema).optional()
  })
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
  return success(
    createNetworkPolicy({
      name: manifest.metadata.name,
      namespace: manifest.metadata.namespace,
      spec: manifest.spec as NetworkPolicySpecInput,
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
