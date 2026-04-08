import { getDeploymentDesiredReplicas } from '../../../../../cluster/ressources/Deployment'
import {
  getNodeExternalIP,
  getNodeInternalIP,
  getNodeRoles,
  getNodeStatus
} from '../../../../../cluster/ressources/Node'
import { getReplicaSetDesiredReplicas } from '../../../../../cluster/ressources/ReplicaSet'
import { getServiceType } from '../../../../../cluster/ressources/Service'
import { formatAge } from '../../../../../shared/formatter'
import type { GeneratedResourceHandlerRegistry } from './resourceHandlerRegistry.generated'
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

const formatNetworkPolicyPodSelector = (
  podSelector: Record<string, unknown> | undefined
): string => {
  if (podSelector == null || typeof podSelector !== 'object') {
    return ''
  }
  const parts: string[] = []
  const matchLabels = podSelector.matchLabels
  if (matchLabels != null && typeof matchLabels === 'object') {
    const entries = Object.entries(matchLabels as Record<string, string>).sort(
      ([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)
    )
    for (const [key, value] of entries) {
      parts.push(`${key}=${value}`)
    }
  }
  const matchExpressions = podSelector.matchExpressions
  if (Array.isArray(matchExpressions)) {
    for (const expr of matchExpressions) {
      if (expr == null || typeof expr !== 'object') {
        continue
      }
      const requirement = expr as {
        key?: string
        operator?: string
        values?: string[]
      }
      const key = requirement.key ?? ''
      const operator = requirement.operator ?? ''
      const valuesJoined =
        requirement.values != null && requirement.values.length > 0
          ? requirement.values.join(',')
          : ''
      parts.push(`${key} ${operator} (${valuesJoined})`)
    }
  }
  return parts.join(',')
}

const formatPersistentVolumeAccessModes = (
  accessModes: readonly string[] | undefined
): string => {
  if (accessModes == null || accessModes.length === 0) {
    return ''
  }
  const shortCodeByAccessMode: Record<string, string> = {
    ReadWriteOnce: 'RWO',
    ReadOnlyMany: 'ROX',
    ReadWriteMany: 'RWX',
    ReadWriteOncePod: 'RWOP'
  }
  return accessModes
    .map((accessMode) => {
      return shortCodeByAccessMode[accessMode] ?? accessMode
    })
    .join(',')
}

export type GetSupportedResource = keyof GeneratedResourceHandlerRegistry

export const RESOURCE_HANDLERS: GeneratedResourceHandlerRegistry = {
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
  endpointslices: {
    getItems: (state) => state.endpointSlices.items,
    headers: ['name', 'address-type', 'ports', 'endpoints', 'age'],
    formatRow: (endpointSlice) => {
      const ports = (endpointSlice.ports ?? [])
        .map((port) => {
          if (port.port == null) {
            return '<unset>'
          }
          return String(port.port)
        })
        .join(',')
      const renderedEndpoints = endpointSlice.endpoints
        .map((endpoint) => endpoint.addresses.join(','))
        .filter((value) => value.length > 0)
      return [
        endpointSlice.metadata.name,
        endpointSlice.addressType,
        ports.length > 0 ? ports : '<none>',
        renderedEndpoints.length > 0 ? renderedEndpoints.join(',') : '<none>',
        formatAge(endpointSlice.metadata.creationTimestamp)
      ]
    },
    supportsFiltering: true
  },
  endpoints: {
    getItems: (state) => state.endpoints.items,
    headers: ['name', 'endpoints', 'age'],
    formatRow: (endpoints) => {
      const subsets = endpoints.subsets ?? []
      const renderedEndpoints: string[] = []
      for (const subset of subsets) {
        const addresses = subset.addresses ?? []
        const ports = subset.ports ?? []
        for (const address of addresses) {
          if (ports.length === 0) {
            renderedEndpoints.push(address.ip)
            continue
          }
          for (const port of ports) {
            renderedEndpoints.push(`${address.ip}:${port.port}`)
          }
        }
      }
      const endpointsColumn =
        renderedEndpoints.length > 0 ? renderedEndpoints.join(',') : '<none>'
      return [
        endpoints.metadata.name,
        endpointsColumn,
        formatAge(endpoints.metadata.creationTimestamp)
      ]
    },
    supportsFiltering: true
  },
  events: {
    getItems: (state) => {
      return [...state.events.items].sort((left, right) => {
        if (left.lastTimestamp === right.lastTimestamp) {
          return left.metadata.name.localeCompare(right.metadata.name)
        }
        return (
          new Date(right.lastTimestamp).getTime() -
          new Date(left.lastTimestamp).getTime()
        )
      })
    },
    headers: ['last seen', 'type', 'reason', 'object', 'message'],
    formatRow: (event) => [
      formatAge(event.lastTimestamp),
      event.type,
      event.reason,
      `${(event.involvedObject.kind ?? '').toLowerCase()}/${event.involvedObject.name ?? ''}`,
      event.message
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
      '',
      formatIngressPorts(),
      formatAge(ingress.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },
  networkpolicies: {
    getItems: (state) => state.networkPolicies.items,
    headers: ['name', 'pod-selector', 'age'],
    formatRow: (networkPolicy) => [
      networkPolicy.metadata.name,
      formatNetworkPolicyPodSelector(networkPolicy.spec.podSelector),
      formatAge(networkPolicy.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },
  ingressclasses: {
    getItems: (state) => state.ingressClasses.items,
    headers: ['name', 'controller', 'parameters', 'age'],
    formatRow: (ingressClass) => [
      ingressClass.metadata.name,
      ingressClass.spec.controller ?? '<none>',
      '<none>',
      formatAge(ingressClass.metadata.creationTimestamp)
    ],
    supportsFiltering: true,
    isClusterScoped: true
  },
  gateways: {
    getItems: (state) => state.gateways.items,
    headers: ['name', 'class', 'address', 'programmed', 'age'],
    formatRow: (gateway) => [
      gateway.metadata.name,
      gateway.spec.gatewayClassName,
      (gateway.status?.addresses ?? []).map((it) => it.value).join(',') || '',
      gateway.status?.conditions?.some((it) => {
        return it.type === 'Programmed' && it.status === 'True'
      })
        ? 'True'
        : 'False',
      formatAge(gateway.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },
  gatewayclasses: {
    getItems: (state) => state.gatewayClasses.items,
    headers: ['name', 'controller', 'accepted', 'age'],
    formatRow: (gatewayClass) => [
      gatewayClass.metadata.name,
      gatewayClass.spec.controllerName,
      gatewayClass.status?.conditions?.some((it) => {
        return it.type === 'Accepted' && it.status === 'True'
      })
        ? 'True'
        : 'False',
      formatAge(gatewayClass.metadata.creationTimestamp)
    ],
    supportsFiltering: true,
    isClusterScoped: true
  },
  httproutes: {
    getItems: (state) => state.httpRoutes.items,
    headers: ['name', 'hostnames', 'age'],
    formatRow: (httpRoute) => [
      httpRoute.metadata.name,
      JSON.stringify(httpRoute.spec.hostnames ?? []),
      formatAge(httpRoute.metadata.creationTimestamp)
    ],
    supportsFiltering: true
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
      'claim',
      'storageclass',
      'volumeattributesclass',
      'reason',
      'age'
    ],
    formatRow: (persistentVolume) => [
      persistentVolume.metadata.name,
      persistentVolume.spec.capacity.storage,
      formatPersistentVolumeAccessModes(persistentVolume.spec.accessModes),
      persistentVolume.spec.persistentVolumeReclaimPolicy ?? 'Retain',
      persistentVolume.status.phase,
      persistentVolume.spec.claimRef != null
        ? `${persistentVolume.spec.claimRef.namespace}/${persistentVolume.spec.claimRef.name}`
        : '',
      persistentVolume.spec.storageClassName ?? '',
      '<unset>',
      '',
      formatAge(persistentVolume.metadata.creationTimestamp)
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
      'volumeattributesclass',
      'age'
    ],
    formatRow: (persistentVolumeClaim) => [
      persistentVolumeClaim.metadata.name,
      persistentVolumeClaim.status.phase,
      persistentVolumeClaim.status.phase === 'Bound'
        ? (persistentVolumeClaim.spec.volumeName ?? '')
        : '',
      persistentVolumeClaim.status.phase === 'Bound'
        ? (persistentVolumeClaim.status.capacity?.storage ??
          persistentVolumeClaim.spec.resources.requests.storage)
        : '',
      persistentVolumeClaim.status.phase === 'Bound'
        ? formatPersistentVolumeAccessModes(
          persistentVolumeClaim.status.accessModes ??
            persistentVolumeClaim.spec.accessModes
        )
        : '',
      persistentVolumeClaim.spec.storageClassName ?? '',
      '<unset>',
      formatAge(persistentVolumeClaim.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },
  storageclasses: {
    getItems: (state) => state.storageClasses.items,
    headers: [
      'name',
      'provisioner',
      'reclaimpolicy',
      'volumebindingmode',
      'allowvolumeexpansion',
      'age'
    ],
    formatRow: (storageClass) => [
      storageClass.metadata.name,
      storageClass.provisioner,
      storageClass.reclaimPolicy,
      storageClass.volumeBindingMode,
      storageClass.allowVolumeExpansion === true ? 'true' : 'false',
      formatAge(storageClass.metadata.creationTimestamp)
    ],
    supportsFiltering: true,
    isClusterScoped: true
  },
  leases: {
    getItems: (state) => state.leases.items,
    headers: ['name', 'holder', 'age'],
    formatRow: (lease) => [
      lease.metadata.name,
      lease.spec.holderIdentity || '<none>',
      formatAge(lease.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  }
}

export const hasResourceHandler = (
  resource: string
): resource is GetSupportedResource => {
  return resource in RESOURCE_HANDLERS
}
