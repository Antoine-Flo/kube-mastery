/**
 * Shared constructor inputs for resource factory helpers (seeds, tests, kubectl).
 * Keeps labels, annotations, and creationTimestamp consistent across kinds.
 */

export type ResourceFactoryMetaFields = {
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp?: string
}

/** Standard namespaced resource factory input (metadata.name + metadata.namespace). */
export type NamespacedFactoryConfigBase = ResourceFactoryMetaFields & {
  name: string
  namespace: string
}

/**
 * Cluster-scoped kinds that only expose metadata.name in configs
 * (factories set metadata.namespace to '' where the shared contract requires it).
 */
export type ClusterScopedNameFactoryConfigBase = ResourceFactoryMetaFields & {
  name: string
}

/** Minimal identity for kinds that do not take labels/annotations in the factory (e.g. Event). */
export type NamespacedIdentityConfig = {
  name: string
  namespace: string
}
