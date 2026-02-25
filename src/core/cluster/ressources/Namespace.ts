import { deepFreeze } from '../../shared/deepFreeze'
import type { KubernetesResource } from '../repositories/types'

interface NamespaceMetadata {
  name: string
  namespace: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp: string
}

export interface Namespace extends KubernetesResource {
  apiVersion: 'v1'
  kind: 'Namespace'
  metadata: NamespaceMetadata
}

interface NamespaceConfig {
  name: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp?: string
}

export const createNamespace = (config: NamespaceConfig): Namespace => {
  const namespace: Namespace = {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {
      name: config.name,
      // Namespace is cluster-scoped. We keep an empty namespace value
      // to satisfy the shared KubernetesResource contract.
      namespace: '',
      creationTimestamp: config.creationTimestamp || new Date().toISOString(),
      ...(config.labels && { labels: config.labels }),
      ...(config.annotations && { annotations: config.annotations })
    }
  }

  return deepFreeze(namespace)
}
