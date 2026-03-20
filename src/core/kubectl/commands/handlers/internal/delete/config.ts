import type { ResourceKind } from '../../../../../cluster/ClusterState'
import type { Resource } from '../../../types'
import type {
  DeleteManifestTargetConfig,
  DeletableResource,
  NamespacedDeleteConfig,
  NamespacedEventDeleteResource
} from './types'

export const NAMESPACED_EVENT_DELETE_CONFIG: Record<
  NamespacedEventDeleteResource,
  NamespacedDeleteConfig
> = {
  pods: {
    kind: 'Pod',
    kindRef: 'pod'
  },
  configmaps: {
    kind: 'ConfigMap',
    kindRef: 'configmap'
  },
  secrets: {
    kind: 'Secret',
    kindRef: 'secret'
  }
}

export const DELETE_TARGET_BY_KIND: Partial<
  Record<ResourceKind, DeleteManifestTargetConfig>
> = {
  Pod: {
    kind: 'Pod',
    kindRef: 'pod',
    kindRefPlural: 'pods',
    namespaced: true
  },
  ConfigMap: {
    kind: 'ConfigMap',
    kindRef: 'configmap',
    kindRefPlural: 'configmaps',
    namespaced: true
  },
  Secret: {
    kind: 'Secret',
    kindRef: 'secret',
    kindRefPlural: 'secrets',
    namespaced: true
  },
  Deployment: {
    kind: 'Deployment',
    kindRef: 'deployment.apps',
    kindRefPlural: 'deployments.apps',
    namespaced: true
  },
  DaemonSet: {
    kind: 'DaemonSet',
    kindRef: 'daemonset.apps',
    kindRefPlural: 'daemonsets.apps',
    namespaced: true
  },
  StatefulSet: {
    kind: 'StatefulSet',
    kindRef: 'statefulset.apps',
    kindRefPlural: 'statefulsets.apps',
    namespaced: true
  },
  ReplicaSet: {
    kind: 'ReplicaSet',
    kindRef: 'replicaset.apps',
    kindRefPlural: 'replicasets.apps',
    namespaced: true
  },
  Ingress: {
    kind: 'Ingress',
    kindRef: 'ingress.networking.k8s.io',
    kindRefPlural: 'ingresses.networking.k8s.io',
    namespaced: true
  },
  Service: {
    kind: 'Service',
    kindRef: 'service',
    kindRefPlural: 'services',
    namespaced: true
  },
  PersistentVolumeClaim: {
    kind: 'PersistentVolumeClaim',
    kindRef: 'persistentvolumeclaim',
    kindRefPlural: 'persistentvolumeclaims',
    namespaced: true
  },
  PersistentVolume: {
    kind: 'PersistentVolume',
    kindRef: 'persistentvolume',
    kindRefPlural: 'persistentvolumes',
    namespaced: false
  },
  Namespace: {
    kind: 'Namespace',
    kindRef: 'namespace',
    kindRefPlural: 'namespaces',
    namespaced: false
  },
  Node: {
    kind: 'Node',
    kindRef: 'node',
    kindRefPlural: 'nodes',
    namespaced: false
  }
}

export const DELETE_TARGET_BY_RESOURCE: Partial<
  Record<DeletableResource, DeleteManifestTargetConfig>
> = {
  pods: DELETE_TARGET_BY_KIND.Pod,
  configmaps: DELETE_TARGET_BY_KIND.ConfigMap,
  secrets: DELETE_TARGET_BY_KIND.Secret,
  deployments: DELETE_TARGET_BY_KIND.Deployment,
  daemonsets: DELETE_TARGET_BY_KIND.DaemonSet,
  statefulsets: DELETE_TARGET_BY_KIND.StatefulSet,
  replicasets: DELETE_TARGET_BY_KIND.ReplicaSet,
  services: DELETE_TARGET_BY_KIND.Service,
  ingresses: DELETE_TARGET_BY_KIND.Ingress,
  persistentvolumes: DELETE_TARGET_BY_KIND.PersistentVolume,
  persistentvolumeclaims: DELETE_TARGET_BY_KIND.PersistentVolumeClaim,
  namespaces: DELETE_TARGET_BY_KIND.Namespace,
  nodes: DELETE_TARGET_BY_KIND.Node
}

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
  if (resource === 'all' || resource === 'ingressclasses') {
    return undefined
  }
  return DELETE_TARGET_BY_RESOURCE[resource]
}
