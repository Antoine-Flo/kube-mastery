import type { ResourceKind } from '../../../../../cluster/ClusterState'
import {
  DELETABLE_KUBECTL_RESOURCES,
  KIND_REFERENCE_BY_KIND,
  NAMESPACED_RESOURCE_KINDS,
  PLURAL_KIND_REFERENCE_BY_KIND,
  RESOURCE_KIND_BY_RESOURCE
} from '../../../resourceCatalog.generated'
import type { Resource } from '../../../types'
import type {
  DeleteManifestTargetConfig,
  DeletableResource,
  NamespacedDeleteConfig,
  NamespacedEventDeleteResource
} from './types'

const NAMESPACED_RESOURCE_KIND_SET = new Set<ResourceKind>(
  NAMESPACED_RESOURCE_KINDS
)

const DELETABLE_RESOURCES: DeletableResource[] = [
  ...DELETABLE_KUBECTL_RESOURCES
] as DeletableResource[]

const buildDeleteTargetConfigForKind = (
  kind: ResourceKind
): DeleteManifestTargetConfig => {
  return {
    kind,
    kindRef: KIND_REFERENCE_BY_KIND[kind],
    kindRefPlural: PLURAL_KIND_REFERENCE_BY_KIND[kind],
    namespaced: NAMESPACED_RESOURCE_KIND_SET.has(kind)
  }
}

export const NAMESPACED_EVENT_DELETE_CONFIG: Record<
  NamespacedEventDeleteResource,
  NamespacedDeleteConfig
> = Object.fromEntries(
  (['pods', 'configmaps', 'secrets'] as NamespacedEventDeleteResource[]).map(
    (resource) => {
      const kind = RESOURCE_KIND_BY_RESOURCE[resource] as ResourceKind
      return [
        resource,
        {
          kind,
          kindRef: KIND_REFERENCE_BY_KIND[kind]
        }
      ]
    }
  )
) as Record<NamespacedEventDeleteResource, NamespacedDeleteConfig>

export const DELETE_TARGET_BY_KIND: Partial<
  Record<ResourceKind, DeleteManifestTargetConfig>
> = Object.fromEntries(
  DELETABLE_RESOURCES.map((resource) => {
    const kind = RESOURCE_KIND_BY_RESOURCE[resource] as ResourceKind
    return [kind, buildDeleteTargetConfigForKind(kind)]
  })
) as Partial<Record<ResourceKind, DeleteManifestTargetConfig>>

export const DELETE_TARGET_BY_RESOURCE: Partial<
  Record<DeletableResource, DeleteManifestTargetConfig>
> = Object.fromEntries(
  DELETABLE_RESOURCES.map((resource) => {
    const kind = RESOURCE_KIND_BY_RESOURCE[resource] as ResourceKind
    return [resource, DELETE_TARGET_BY_KIND[kind]]
  })
) as Partial<Record<DeletableResource, DeleteManifestTargetConfig>>

export const DELETE_ALL_RESOURCE_ORDER: DeletableResource[] = [
  'pods',
  'services',
  'daemonsets',
  'deployments',
  'replicasets'
]

export const getDeleteTargetConfig = (
  resource: Resource
): DeleteManifestTargetConfig | undefined => {
  if (resource === 'all') {
    return undefined
  }
  return DELETE_TARGET_BY_RESOURCE[resource]
}
