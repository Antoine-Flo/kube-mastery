import type { ClusterStateData } from '../../cluster/ClusterState'
import type { DescribeDependencies } from './interface'
import { describeConfigMap } from './describers/describeConfigMap'
import { describeDeployment } from './describers/describeDeployment'
import {
  describeEndpointSlice,
  describeEndpoints,
  describeService
} from './describers/describeEndpointsServiceSlice'
import { describeIngress } from './describers/describeIngress'
import { describeLease } from './describers/describeLease'
import { describeNetworkPolicy } from './describers/describeNetworkPolicy'
import { describeNode } from './describers/describeNode'
import { describePersistentVolume } from './describers/describePersistentVolume'
import { describePersistentVolumeClaim } from './describers/describePersistentVolumeClaim'
import { describePod } from './describers/describePod'
import { describeReplicaSet } from './describers/describeReplicaSet'
import {
  describeClusterRole,
  describeClusterRoleBinding,
  describeRole,
  describeRoleBinding
} from './describers/describeRbac'
import { describeSecret } from './describers/describeSecret'
import { describeServiceAccount } from './describers/describeServiceAccount'
import { describeStorageClass } from './describers/describeStorageClass'
import * as extras from './describers/extras'

/**
 * Registry of kubectl describe handlers (mirrors describerMap in
 * refs/k8s/kubectl/pkg/describe/describe.go, keyed by CLI resource name).
 */
export interface DescribeResourceConfig {
  items: keyof ClusterStateData
  formatter: (
    item: any,
    state: ClusterStateData,
    dependencies: DescribeDependencies
  ) => string
  type: string
  isClusterScoped?: boolean
  allowsDescribeWithoutName?: boolean
}

export const DESCRIBE_CONFIG: Record<string, DescribeResourceConfig> = {
  pods: {
    items: 'pods',
    formatter: (item, _state, dependencies) => {
      const podEvents = dependencies.listPodEvents?.(
        item.metadata.namespace,
        item.metadata.name
      )
      return describePod(item, podEvents)
    },
    type: 'Pod'
  },
  configmaps: {
    items: 'configMaps',
    formatter: (item) => {
      return describeConfigMap(item)
    },
    type: 'ConfigMap'
  },
  secrets: {
    items: 'secrets',
    formatter: (item) => {
      return describeSecret(item)
    },
    type: 'Secret'
  },
  serviceaccounts: {
    items: 'serviceAccounts',
    formatter: (item) => {
      return describeServiceAccount(item)
    },
    type: 'ServiceAccount'
  },
  services: {
    items: 'services',
    formatter: (item, state) => {
      return describeService(item, state)
    },
    type: 'Service'
  },
  endpoints: {
    items: 'endpoints',
    formatter: (item) => {
      return describeEndpoints(item)
    },
    type: 'Endpoints'
  },
  endpointslices: {
    items: 'endpointSlices',
    formatter: (item) => {
      return describeEndpointSlice(item)
    },
    type: 'EndpointSlice'
  },
  events: {
    items: 'events',
    formatter: (item) => {
      return extras.describeCoreEvent(item)
    },
    type: 'Event',
    allowsDescribeWithoutName: true
  },
  deployments: {
    items: 'deployments',
    formatter: (item, state, dependencies) => {
      const deploymentEvents = dependencies.listDeploymentEvents?.(
        item.metadata.namespace,
        item.metadata.name
      )
      return describeDeployment(item, state, deploymentEvents)
    },
    type: 'Deployment'
  },
  replicasets: {
    items: 'replicaSets',
    formatter: (item, state) => {
      return describeReplicaSet(item, state)
    },
    type: 'ReplicaSet'
  },
  ingresses: {
    items: 'ingresses',
    formatter: (item) => {
      return describeIngress(item)
    },
    type: 'Ingress'
  },
  ingressclasses: {
    items: 'ingressClasses',
    formatter: (item) => {
      return extras.describeIngressClass(item)
    },
    type: 'IngressClass',
    isClusterScoped: true
  },
  gatewayclasses: {
    items: 'gatewayClasses',
    formatter: (item) => {
      return extras.describeGatewayClass(item)
    },
    type: 'GatewayClass',
    isClusterScoped: true
  },
  gateways: {
    items: 'gateways',
    formatter: (item) => {
      return extras.describeGateway(item)
    },
    type: 'Gateway'
  },
  httproutes: {
    items: 'httpRoutes',
    formatter: (item) => {
      return extras.describeHTTPRoute(item)
    },
    type: 'HTTPRoute'
  },
  networkpolicies: {
    items: 'networkPolicies',
    formatter: (item) => {
      return describeNetworkPolicy(item)
    },
    type: 'NetworkPolicy'
  },
  roles: {
    items: 'roles',
    formatter: (item) => {
      return describeRole(item)
    },
    type: 'Role'
  },
  rolebindings: {
    items: 'roleBindings',
    formatter: (item) => {
      return describeRoleBinding(item)
    },
    type: 'RoleBinding'
  },
  clusterroles: {
    items: 'clusterRoles',
    formatter: (item) => {
      return describeClusterRole(item)
    },
    type: 'ClusterRole',
    isClusterScoped: true
  },
  clusterrolebindings: {
    items: 'clusterRoleBindings',
    formatter: (item) => {
      return describeClusterRoleBinding(item)
    },
    type: 'ClusterRoleBinding',
    isClusterScoped: true
  },
  nodes: {
    items: 'nodes',
    formatter: (item, state) => {
      return describeNode(item, state)
    },
    type: 'Node',
    isClusterScoped: true,
    allowsDescribeWithoutName: true
  },
  persistentvolumes: {
    items: 'persistentVolumes',
    formatter: (item) => {
      return describePersistentVolume(item)
    },
    type: 'PersistentVolume',
    isClusterScoped: true
  },
  persistentvolumeclaims: {
    items: 'persistentVolumeClaims',
    formatter: (item, state, dependencies) => {
      const events = dependencies.listPersistentVolumeClaimEvents?.(
        item.metadata.namespace,
        item.metadata.name
      )
      return describePersistentVolumeClaim(item, state, events)
    },
    type: 'PersistentVolumeClaim'
  },
  storageclasses: {
    items: 'storageClasses',
    formatter: (item) => {
      return describeStorageClass(item)
    },
    type: 'StorageClass',
    isClusterScoped: true
  },
  leases: {
    items: 'leases',
    formatter: (item) => {
      return describeLease(item)
    },
    type: 'Lease'
  }
} as const
