import type { ResourceKind } from '../../cluster/ClusterState'
import type { Resource } from './types'

export const SUPPORTED_RESOURCE_KINDS: ResourceKind[] = [
  'Pod',
  'ConfigMap',
  'Secret',
  'Node',
  'Namespace',
  'Ingress',
  'ReplicaSet',
  'Deployment',
  'DaemonSet',
  'StatefulSet',
  'EndpointSlice',
  'PersistentVolume',
  'PersistentVolumeClaim',
  'Service',
  'Endpoints',
  'Lease'
]

export const NAMESPACED_RESOURCE_KINDS: ResourceKind[] = [
  'Pod',
  'ConfigMap',
  'Secret',
  'ReplicaSet',
  'Deployment',
  'DaemonSet',
  'StatefulSet',
  'PersistentVolumeClaim',
  'Service',
  'EndpointSlice',
  'Endpoints',
  'Ingress',
  'Lease'
]

export const RESOURCE_KIND_BY_RESOURCE: Record<
  Resource,
  ResourceKind | undefined
> = {
  all: undefined,
  pods: 'Pod',
  deployments: 'Deployment',
  services: 'Service',
  endpointslices: 'EndpointSlice',
  endpoints: 'Endpoints',
  namespaces: 'Namespace',
  configmaps: 'ConfigMap',
  secrets: 'Secret',
  nodes: 'Node',
  daemonsets: 'DaemonSet',
  statefulsets: 'StatefulSet',
  replicasets: 'ReplicaSet',
  ingresses: 'Ingress',
  ingressclasses: undefined,
  persistentvolumes: 'PersistentVolume',
  persistentvolumeclaims: 'PersistentVolumeClaim',
  leases: 'Lease'
}

const KIND_REFERENCE_BY_KIND: Partial<Record<ResourceKind, string>> = {
  EndpointSlice: 'endpointslice.discovery.k8s.io',
  Endpoints: 'endpoints',
  Deployment: 'deployment.apps',
  DaemonSet: 'daemonset.apps',
  StatefulSet: 'statefulset.apps',
  ReplicaSet: 'replicaset.apps',
  Ingress: 'ingress.networking.k8s.io',
  Lease: 'lease.coordination.k8s.io'
}

const PLURAL_KIND_REFERENCE_BY_KIND: Partial<Record<ResourceKind, string>> = {
  EndpointSlice: 'endpointslices.discovery.k8s.io',
  Endpoints: 'endpoints',
  Deployment: 'deployments.apps',
  DaemonSet: 'daemonsets.apps',
  StatefulSet: 'statefulsets.apps',
  ReplicaSet: 'replicasets.apps',
  Ingress: 'ingresses.networking.k8s.io',
  Namespace: 'namespaces',
  PersistentVolume: 'persistentvolumes',
  PersistentVolumeClaim: 'persistentvolumeclaims',
  Lease: 'leases.coordination.k8s.io'
}

export const RESOURCE_OUTPUT_METADATA_BY_RESOURCE: Record<
  Exclude<Resource, 'all'>,
  {
    apiVersion: string
    kind: string
  }
> = {
  pods: { apiVersion: 'v1', kind: 'Pod' },
  configmaps: { apiVersion: 'v1', kind: 'ConfigMap' },
  secrets: { apiVersion: 'v1', kind: 'Secret' },
  nodes: { apiVersion: 'v1', kind: 'Node' },
  replicasets: { apiVersion: 'apps/v1', kind: 'ReplicaSet' },
  deployments: { apiVersion: 'apps/v1', kind: 'Deployment' },
  daemonsets: { apiVersion: 'apps/v1', kind: 'DaemonSet' },
  statefulsets: { apiVersion: 'apps/v1', kind: 'StatefulSet' },
  services: { apiVersion: 'v1', kind: 'Service' },
  endpointslices: { apiVersion: 'discovery.k8s.io/v1', kind: 'EndpointSlice' },
  ingresses: { apiVersion: 'networking.k8s.io/v1', kind: 'Ingress' },
  ingressclasses: { apiVersion: 'networking.k8s.io/v1', kind: 'IngressClass' },
  namespaces: { apiVersion: 'v1', kind: 'Namespace' },
  endpoints: { apiVersion: 'v1', kind: 'Endpoints' },
  persistentvolumes: { apiVersion: 'v1', kind: 'PersistentVolume' },
  persistentvolumeclaims: { apiVersion: 'v1', kind: 'PersistentVolumeClaim' },
  leases: { apiVersion: 'coordination.k8s.io/v1', kind: 'Lease' }
}

export const isSupportedResourceKind = (kind: string): kind is ResourceKind => {
  return SUPPORTED_RESOURCE_KINDS.includes(kind as ResourceKind)
}

export const isNamespacedResourceKind = (kind: ResourceKind): boolean => {
  return NAMESPACED_RESOURCE_KINDS.includes(kind)
}

export const toKindReference = (kind: ResourceKind): string => {
  return KIND_REFERENCE_BY_KIND[kind] ?? kind.toLowerCase()
}

export const toPluralKindReference = (kind: ResourceKind): string => {
  return PLURAL_KIND_REFERENCE_BY_KIND[kind] ?? `${kind.toLowerCase()}s`
}

export const toKindReferenceForValidation = (kind: ResourceKind): string => {
  const kindReference = toKindReference(kind)
  const [resource, ...group] = kindReference.split('.')
  const capitalizedResource = `${resource.charAt(0).toUpperCase()}${resource.slice(1)}`
  if (group.length === 0) {
    return capitalizedResource
  }
  return `${capitalizedResource}.${group.join('.')}`
}

export const toResourceKindReference = (resource: Resource): string => {
  if (resource === 'all') {
    return 'resource'
  }
  if (resource === 'ingressclasses') {
    return 'ingressclass.networking.k8s.io'
  }
  const resourceKind = RESOURCE_KIND_BY_RESOURCE[resource]
  if (resourceKind == null) {
    return resource
  }
  return toKindReference(resourceKind)
}

export const toPluralResourceKindReference = (resource: Resource): string => {
  if (resource === 'all') {
    return 'resources'
  }
  if (resource === 'ingressclasses') {
    return 'ingressclasses.networking.k8s.io'
  }
  const resourceKind = RESOURCE_KIND_BY_RESOURCE[resource]
  if (resourceKind == null) {
    return resource
  }
  return toPluralKindReference(resourceKind)
}
