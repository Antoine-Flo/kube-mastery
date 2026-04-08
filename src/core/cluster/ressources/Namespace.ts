import { deepFreeze } from '../../shared/deepFreeze'
import type {
  K8sNamespace,
  K8sNamespaceMetadata
} from '../../openapi/generated/k8sOpenapiAliases.generated'
import type { ClusterScopedNameFactoryConfigBase } from './resourceFactoryConfig'

type NamespaceMetadata = Pick<
  K8sNamespaceMetadata,
  'name' | 'namespace' | 'labels' | 'annotations' | 'creationTimestamp'
>

export type Namespace = Omit<K8sNamespace, 'metadata' | 'spec' | 'status'> & {
  metadata: NamespaceMetadata
}

interface NamespaceConfig extends ClusterScopedNameFactoryConfigBase {}

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
