import type { ConfigMap } from '../../../../../cluster/ressources/ConfigMap'
import type { DaemonSet } from '../../../../../cluster/ressources/DaemonSet'
import type { Deployment } from '../../../../../cluster/ressources/Deployment'
import { getDeploymentDesiredReplicas } from '../../../../../cluster/ressources/Deployment'
import type { EndpointSlice } from '../../../../../cluster/ressources/EndpointSlice'
import type { Endpoints } from '../../../../../cluster/ressources/Endpoints'
import type { Ingress } from '../../../../../cluster/ressources/Ingress'
import type { Lease } from '../../../../../cluster/ressources/Lease'
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
import type { StorageClass } from '../../../../../cluster/ressources/StorageClass'
import type { Service } from '../../../../../cluster/ressources/Service'
import { getServiceType } from '../../../../../cluster/ressources/Service'
import type { StatefulSet } from '../../../../../cluster/ressources/StatefulSet'
import {
  listGatewayClassesForGet,
  listGatewaysForGet,
  listHttpRoutesForGet,
  type GatewayClassSyntheticResource,
  type GatewaySyntheticResource,
  type HTTPRouteSyntheticResource
} from '../../../../../gateway-api/envoy/api'
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

interface IngressClassSyntheticResource {
  metadata: {
    name: string
    namespace: string
    creationTimestamp: string
  }
  spec: {
    controller: string
  }
}

const hasIngressNginxController = (
  state: {
    deployments: { items: Deployment[] }
    pods: { items: Pod[] }
  }
): boolean => {
  const deploymentExists = state.deployments.items.some((deployment) => {
    return (
      deployment.metadata.namespace === 'ingress-nginx' &&
      deployment.metadata.name === 'ingress-nginx-controller'
    )
  })
  if (deploymentExists) {
    return true
  }
  return state.pods.items.some((pod) => {
    return (
      pod.metadata.namespace === 'ingress-nginx' &&
      (pod.metadata.labels?.['app.kubernetes.io/component'] === 'controller' ||
        pod.metadata.name.startsWith('ingress-nginx-controller'))
    )
  })
}

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
  endpointslices: ResourceHandler<EndpointSlice>
  endpoints: ResourceHandler<Endpoints>
  ingresses: ResourceHandler<Ingress>
  ingressclasses: ResourceHandler<IngressClassSyntheticResource>
  gateways: ResourceHandler<GatewaySyntheticResource>
  gatewayclasses: ResourceHandler<GatewayClassSyntheticResource>
  httproutes: ResourceHandler<HTTPRouteSyntheticResource>
  namespaces: ResourceHandler<Namespace>
  persistentvolumes: ResourceHandler<PersistentVolume>
  persistentvolumeclaims: ResourceHandler<PersistentVolumeClaim>
  storageclasses: ResourceHandler<StorageClass>
  leases: ResourceHandler<Lease>
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
  ingressclasses: {
    getItems: (state) => {
      if (!hasIngressNginxController(state)) {
        return []
      }
      const controllerDeployment = state.deployments.items.find((deployment) => {
        return (
          deployment.metadata.namespace === 'ingress-nginx' &&
          deployment.metadata.name === 'ingress-nginx-controller'
        )
      })
      return [
        {
          metadata: {
            name: 'nginx',
            namespace: '',
            creationTimestamp:
              controllerDeployment?.metadata.creationTimestamp ??
              new Date().toISOString()
          },
          spec: {
            controller: 'k8s.io/ingress-nginx'
          }
        }
      ]
    },
    headers: ['name', 'controller', 'parameters', 'age'],
    formatRow: (ingressClass) => [
      ingressClass.metadata.name,
      ingressClass.spec.controller,
      '<none>',
      formatAge(ingressClass.metadata.creationTimestamp)
    ],
    supportsFiltering: true,
    isClusterScoped: true
  },
  gateways: {
    getItems: (state) => listGatewaysForGet(state),
    headers: ['name', 'class', 'address', 'programmed', 'age'],
    formatRow: (gateway) => [
      gateway.metadata.name,
      gateway.spec.gatewayClassName,
      gateway.status.address,
      gateway.status.programmed,
      formatAge(gateway.metadata.creationTimestamp)
    ],
    supportsFiltering: true
  },
  gatewayclasses: {
    getItems: (state) => listGatewayClassesForGet(state),
    headers: ['name', 'controller', 'accepted', 'age'],
    formatRow: (gatewayClass) => [
      gatewayClass.metadata.name,
      gatewayClass.spec.controllerName,
      'True',
      formatAge(gatewayClass.metadata.creationTimestamp)
    ],
    supportsFiltering: true,
    isClusterScoped: true
  },
  httproutes: {
    getItems: (state) => listHttpRoutesForGet(state),
    headers: ['name', 'hostnames', 'age'],
    formatRow: (httpRoute) => [
      httpRoute.metadata.name,
      httpRoute.spec.hostnames.join(','),
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
      persistentVolumeClaim.status.phase === 'Bound'
        ? (persistentVolumeClaim.spec.volumeName ?? '')
        : '',
      persistentVolumeClaim.status.phase === 'Bound'
        ? persistentVolumeClaim.spec.resources.requests.storage
        : '',
      persistentVolumeClaim.status.phase === 'Bound'
        ? persistentVolumeClaim.spec.accessModes.join(',')
        : '',
      persistentVolumeClaim.spec.storageClassName ?? '<none>',
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
