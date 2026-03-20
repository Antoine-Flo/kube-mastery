import type { ConfigMap } from '../../../../../cluster/ressources/ConfigMap'
import type { DaemonSet } from '../../../../../cluster/ressources/DaemonSet'
import type { Deployment } from '../../../../../cluster/ressources/Deployment'
import { getDeploymentDesiredReplicas } from '../../../../../cluster/ressources/Deployment'
import type { Ingress } from '../../../../../cluster/ressources/Ingress'
import type { Namespace } from '../../../../../cluster/ressources/Namespace'
import type { Node } from '../../../../../cluster/ressources/Node'
import {
  getNodeExternalIP,
  getNodeInternalIP,
  getNodeRoles,
  getNodeStatus
} from '../../../../../cluster/ressources/Node'
import type { PersistentVolume } from '../../../../../cluster/ressources/PersistentVolume'
import type { PersistentVolumeClaim } from '../../../../../cluster/ressources/PersistentVolumeClaim'
import type { Pod } from '../../../../../cluster/ressources/Pod'
import type { ReplicaSet } from '../../../../../cluster/ressources/ReplicaSet'
import { getReplicaSetDesiredReplicas } from '../../../../../cluster/ressources/ReplicaSet'
import type { Secret } from '../../../../../cluster/ressources/Secret'
import type { Service } from '../../../../../cluster/ressources/Service'
import { getServiceType } from '../../../../../cluster/ressources/Service'
import type { StatefulSet } from '../../../../../cluster/ressources/StatefulSet'
import { formatAge } from '../../../../../shared/formatter'
import {
  getPodDisplayStatus,
  getPodIP,
  getPodNodeName,
  getPodReady,
  getPodRestartsDisplay
} from './podPresentation'
import {
  formatIngressClass,
  formatIngressHosts,
  formatIngressPorts,
  formatNodeSelector,
  formatServicePorts,
  getSecretType,
  getServiceExternalIP
} from './resourceFormatters'
import type { ResourceHandler } from './types'

interface ResourceHandlerRegistry {
  pods: ResourceHandler<Pod>
  configmaps: ResourceHandler<ConfigMap>
  secrets: ResourceHandler<Secret>
  nodes: ResourceHandler<Node>
  replicasets: ResourceHandler<ReplicaSet>
  daemonsets: ResourceHandler<DaemonSet>
  statefulsets: ResourceHandler<StatefulSet>
  deployments: ResourceHandler<Deployment>
  services: ResourceHandler<Service>
  ingresses: ResourceHandler<Ingress>
  ingressclasses: ResourceHandler<Namespace>
  namespaces: ResourceHandler<Namespace>
  persistentvolumes: ResourceHandler<PersistentVolume>
  persistentvolumeclaims: ResourceHandler<PersistentVolumeClaim>
}

export type GetSupportedResource = keyof ResourceHandlerRegistry

export const RESOURCE_HANDLERS: ResourceHandlerRegistry = {
  pods: {
    getItems: (state) => state.pods.items,
    headers: ['name', 'ready', 'status', 'restarts', 'age'],
    formatRow: (pod) => [
      pod.metadata.name,
      getPodReady(pod),
      getPodDisplayStatus(pod),
      getPodRestartsDisplay(pod),
      formatAge(pod.metadata.creationTimestamp)
    ],
    supportsFiltering: true,
    align: ['left', 'right', 'left', 'right', 'right'],
    headersWide: [
      'name',
      'ready',
      'status',
      'restarts',
      'age',
      'ip',
      'node',
      'nominated node',
      'readiness gates'
    ],
    formatRowWide: (pod) => [
      pod.metadata.name,
      getPodReady(pod),
      getPodDisplayStatus(pod),
      getPodRestartsDisplay(pod),
      formatAge(pod.metadata.creationTimestamp),
      getPodIP(pod),
      getPodNodeName(pod),
      '<none>',
      '<none>'
    ]
  },
  configmaps: {
    getItems: (state) => state.configMaps.items,
    headers: ['name', 'data', 'age'],
    formatRow: (configMap) => [
      configMap.metadata.name,
      Object.keys(configMap.data || {}).length.toString(),
      formatAge(configMap.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },
  secrets: {
    getItems: (state) => state.secrets.items,
    headers: ['name', 'type', 'data', 'age'],
    formatRow: (secret) => [
      secret.metadata.name,
      getSecretType(secret.type),
      Object.keys(secret.data || {}).length.toString(),
      formatAge(secret.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },
  nodes: {
    getItems: (state) => state.nodes.items,
    headers: ['name', 'status', 'roles', 'age', 'version'],
    formatRow: (node) => [
      node.metadata.name,
      getNodeStatus(node),
      getNodeRoles(node),
      formatAge(node.metadata.creationTimestamp),
      node.status.nodeInfo.kubeletVersion
    ],
    supportsFiltering: true,
    isClusterScoped: true,
    formatRowWide: (node) => [
      node.metadata.name,
      getNodeStatus(node),
      getNodeRoles(node),
      formatAge(node.metadata.creationTimestamp),
      node.status.nodeInfo.kubeletVersion,
      getNodeInternalIP(node),
      getNodeExternalIP(node),
      node.status.nodeInfo.osImage,
      node.status.nodeInfo.kernelVersion,
      node.status.nodeInfo.containerRuntimeVersion
    ],
    headersWide: [
      'name',
      'status',
      'roles',
      'age',
      'version',
      'internal-ip',
      'external-ip',
      'os-image',
      'kernel-version',
      'container-runtime'
    ]
  },
  replicasets: {
    getItems: (state) => state.replicaSets.items,
    headers: ['name', 'desired', 'current', 'ready', 'age'],
    formatRow: (replicaSet) => [
      replicaSet.metadata.name,
      String(getReplicaSetDesiredReplicas(replicaSet)),
      String(replicaSet.status.replicas),
      String(replicaSet.status.readyReplicas ?? 0),
      formatAge(replicaSet.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },
  daemonsets: {
    getItems: (state) => state.daemonSets.items,
    headers: [
      'name',
      'desired',
      'current',
      'ready',
      'up-to-date',
      'available',
      'node selector',
      'age'
    ],
    formatRow: (daemonSet) => [
      daemonSet.metadata.name,
      String(daemonSet.status.desiredNumberScheduled ?? 0),
      String(daemonSet.status.currentNumberScheduled ?? 0),
      String(daemonSet.status.numberReady ?? 0),
      String(daemonSet.status.currentNumberScheduled ?? 0),
      String(daemonSet.status.numberReady ?? 0),
      formatNodeSelector(daemonSet.spec.template.spec.nodeSelector),
      formatAge(daemonSet.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },
  statefulsets: {
    getItems: (state) => state.statefulSets.items,
    headers: ['name', 'ready', 'age'],
    formatRow: (statefulSet) => [
      statefulSet.metadata.name,
      `${statefulSet.status.readyReplicas ?? 0}/${statefulSet.spec.replicas ?? 1}`,
      formatAge(statefulSet.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },
  deployments: {
    getItems: (state) => state.deployments.items,
    headers: ['name', 'ready', 'up-to-date', 'available', 'age'],
    formatRow: (deployment) => [
      deployment.metadata.name,
      `${deployment.status.readyReplicas ?? 0}/${getDeploymentDesiredReplicas(deployment)}`,
      String(deployment.status.updatedReplicas ?? 0),
      String(deployment.status.availableReplicas ?? 0),
      formatAge(deployment.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },
  services: {
    getItems: (state) => state.services.items,
    headers: ['name', 'type', 'cluster-ip', 'external-ip', 'port(s)', 'age'],
    formatRow: (service) => [
      service.metadata.name,
      getServiceType(service),
      service.spec.clusterIP || '<none>',
      getServiceExternalIP(service),
      formatServicePorts(service),
      formatAge(service.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },
  ingresses: {
    getItems: (state) => state.ingresses.items,
    headers: ['name', 'class', 'hosts', 'address', 'ports', 'age'],
    formatRow: (ingress) => [
      ingress.metadata.name,
      formatIngressClass(ingress),
      formatIngressHosts(ingress),
      '<none>',
      formatIngressPorts(),
      formatAge(ingress.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },
  ingressclasses: {
    getItems: () => [],
    headers: ['name', 'controller', 'parameters', 'age'],
    formatRow: () => ['<none>', '<none>', '<none>', '<none>'],
    supportsFiltering: true,
    isClusterScoped: true
  },
  namespaces: {
    getItems: (state) => state.namespaces.items,
    headers: ['name', 'status', 'age'],
    formatRow: (namespace) => [
      namespace.metadata.name,
      'Active',
      formatAge(namespace.metadata.creationTimestamp)
    ],
    supportsFiltering: true,
    isClusterScoped: true
  },
  persistentvolumes: {
    getItems: (state) => state.persistentVolumes.items,
    headers: [
      'name',
      'capacity',
      'access modes',
      'reclaim policy',
      'status',
      'claim'
    ],
    formatRow: (persistentVolume) => [
      persistentVolume.metadata.name,
      persistentVolume.spec.capacity.storage,
      persistentVolume.spec.accessModes.join(','),
      persistentVolume.spec.persistentVolumeReclaimPolicy ?? 'Retain',
      persistentVolume.status.phase,
      persistentVolume.spec.claimRef != null
        ? `${persistentVolume.spec.claimRef.namespace}/${persistentVolume.spec.claimRef.name}`
        : '<none>'
    ],
    supportsFiltering: true,
    isClusterScoped: true
  },
  persistentvolumeclaims: {
    getItems: (state) => state.persistentVolumeClaims.items,
    headers: [
      'name',
      'status',
      'volume',
      'capacity',
      'access modes',
      'storageclass',
      'age'
    ],
    formatRow: (persistentVolumeClaim) => [
      persistentVolumeClaim.metadata.name,
      persistentVolumeClaim.status.phase,
      persistentVolumeClaim.spec.volumeName ?? '<none>',
      persistentVolumeClaim.spec.resources.requests.storage,
      persistentVolumeClaim.spec.accessModes.join(','),
      persistentVolumeClaim.spec.storageClassName ?? '<none>',
      formatAge(persistentVolumeClaim.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  }
}

export const hasResourceHandler = (resource: string): resource is GetSupportedResource => {
  return resource in RESOURCE_HANDLERS
}
