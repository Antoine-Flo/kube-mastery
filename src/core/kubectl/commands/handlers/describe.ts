import type { ClusterStateData } from '../../../cluster/ClusterState'
import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import {
  getGatewayClassDescribeOutput,
  getGatewayDescribeOutput,
  getHttpRouteDescribeOutput
} from '../../../gateway-api/envoy/api'
import type { DeploymentLifecycleDescribeEvent } from '../../../api/DeploymentLifecycleEventStore'
import type { PersistentVolumeClaimLifecycleDescribeEvent } from '../../../api/PersistentVolumeClaimLifecycleEventStore'
import type { PodLifecycleDescribeEvent } from '../../../api/PodLifecycleEventStore'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import {
  describeConfigMap,
  describeDeployment,
  describeEndpointSlice,
  describeEndpoints,
  describeIngress,
  describeNetworkPolicy,
  describeLease,
  describeNode,
  describePersistentVolume,
  describePersistentVolumeClaim,
  describePod,
  describeReplicaSet,
  describeSecret,
  describeStorageClass,
  describeService
} from '../../formatters/describeFormatters'
import { applyFilters, noResourcesMessage } from './internal/get/filters'
import type { ParsedCommand } from '../types'

// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL DESCRIBE HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Configuration-driven approach: each resource defines its collection and formatter

/**
 * Resource describe configuration
 * Declarative approach similar to get.ts RESOURCE_HANDLERS
 */
interface DescribeConfig {
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

interface DescribeableResource {
  metadata: {
    name: string
    namespace: string
    labels?: Record<string, string>
  }
}

interface DescribeDependencies {
  listPodEvents?: (
    namespace: string,
    podName: string
  ) => readonly PodLifecycleDescribeEvent[]
  listDeploymentEvents?: (
    namespace: string,
    deploymentName: string
  ) => readonly DeploymentLifecycleDescribeEvent[]
  listPersistentVolumeClaimEvents?: (
    namespace: string,
    persistentVolumeClaimName: string
  ) => readonly PersistentVolumeClaimLifecycleDescribeEvent[]
}

const formatEventTimestampForDescribe = (timestamp: string): string => {
  if (timestamp.includes('.')) {
    return timestamp.replace(/\.\d{3}Z$/, 'Z')
  }
  return timestamp
}

const describeCoreEvent = (
  eventItem: {
    metadata: {
      name: string
      namespace: string
      labels?: Record<string, string>
      creationTimestamp: string
      resourceVersion?: string
      uid?: string
    }
    involvedObject: {
      apiVersion: string
      kind: string
      name: string
      namespace?: string
    }
    reason: string
    message: string
    type: string
    count: number
    firstTimestamp: string
    lastTimestamp: string
  }
): string => {
  const involvedNamespace =
    eventItem.involvedObject.namespace ?? eventItem.metadata.namespace
  const labels = eventItem.metadata.labels
  const labelsText =
    labels == null || Object.keys(labels).length === 0
      ? '<none>'
      : Object.entries(labels)
          .map(([key, value]) => `${key}=${value}`)
          .join(',')
  const resourceVersion = eventItem.metadata.resourceVersion ?? '<unknown>'
  const uid = eventItem.metadata.uid ?? '<unknown>'
  const firstTimestamp = formatEventTimestampForDescribe(eventItem.firstTimestamp)
  const lastTimestamp = formatEventTimestampForDescribe(eventItem.lastTimestamp)
  const creationTimestamp = formatEventTimestampForDescribe(
    eventItem.metadata.creationTimestamp
  )
  return [
    `Name:             ${eventItem.metadata.name}`,
    `Namespace:        ${eventItem.metadata.namespace}`,
    `Labels:           ${labelsText}`,
    'Annotations:      <none>',
    'API Version:      v1',
    `Count:            ${eventItem.count}`,
    'Event Time:       <nil>',
    `First Timestamp:  ${firstTimestamp}`,
    'Involved Object:',
    `  API Version:   ${eventItem.involvedObject.apiVersion}`,
    `  Kind:          ${eventItem.involvedObject.kind}`,
    `  Name:          ${eventItem.involvedObject.name}`,
    `  Namespace:     ${involvedNamespace}`,
    'Kind:            Event',
    `Last Timestamp:  ${lastTimestamp}`,
    `Message:         ${eventItem.message}`,
    'Metadata:',
    `  Creation Timestamp:  ${creationTimestamp}`,
    `  Resource Version:    ${resourceVersion}`,
    `  UID:                 ${uid}`,
    `Reason:                ${eventItem.reason}`,
    'Reporting Component:   ',
    'Reporting Instance:    ',
    'Source:',
    `Type:    ${eventItem.type}`,
    'Events:  <none>'
  ].join('\n')
}

const sortDescribeResources = (
  resources: DescribeableResource[]
): DescribeableResource[] => {
  return [...resources].sort((left, right) => {
    const namespaceDiff = left.metadata.namespace.localeCompare(
      right.metadata.namespace
    )
    if (namespaceDiff !== 0) {
      return namespaceDiff
    }
    return left.metadata.name.localeCompare(right.metadata.name)
  })
}

const DESCRIBE_CONFIG: Record<string, DescribeConfig> = {
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
      return describeCoreEvent(item)
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
  networkpolicies: {
    items: 'networkPolicies',
    formatter: (item) => {
      return describeNetworkPolicy(item)
    },
    type: 'NetworkPolicy'
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

const getNotFoundResourceReference = (resourceType: string): string => {
  if (resourceType === 'deployments') {
    return 'deployments.apps'
  }
  if (resourceType === 'replicasets') {
    return 'replicasets.apps'
  }
  if (resourceType === 'networkpolicies') {
    return 'networkpolicies.networking.k8s.io'
  }
  return resourceType
}

/**
 * Handle kubectl describe command
 * Provides detailed multi-line output for pods, configmaps, and secrets
 */
export const handleDescribe = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand,
  dependencies: DescribeDependencies = {}
): ExecutionResult => {
  const state = apiServer.snapshotState()
  const resolvedDependencies: DescribeDependencies = {
    listPodEvents:
      dependencies.listPodEvents ??
      apiServer.podLifecycleEventStore.listPodEvents,
    listDeploymentEvents:
      dependencies.listDeploymentEvents ??
      apiServer.deploymentLifecycleEventStore.listDeploymentEvents,
    listPersistentVolumeClaimEvents:
      dependencies.listPersistentVolumeClaimEvents ??
      apiServer.persistentVolumeClaimLifecycleEventStore
        .listPersistentVolumeClaimEvents
  }
  if (!parsed.resource) {
    return error(`error: you must specify the resource type to describe`)
  }

  const resourceType = parsed.resource
  if (resourceType === 'ingressclasses') {
    if (!parsed.name) {
      return error(`error: you must specify the name of the resource to describe`)
    }
    const ingressControllerInstalled = state.deployments.items.some(
      (deployment) => {
        return (
          deployment.metadata.namespace === 'ingress-nginx' &&
          deployment.metadata.name === 'ingress-nginx-controller'
        )
      }
    )
    if (ingressControllerInstalled && parsed.name === 'nginx') {
      return success(
        [
          'Name:         nginx',
          'Labels:       app.kubernetes.io/component=controller',
          '              app.kubernetes.io/instance=ingress-nginx',
          '              app.kubernetes.io/name=ingress-nginx',
          '              app.kubernetes.io/part-of=ingress-nginx',
          '              app.kubernetes.io/version=1.15.1',
          'Annotations:  <none>',
          'Controller:   k8s.io/ingress-nginx',
          'Events:       <none>'
        ].join('\n')
      )
    }
    return error(
      `Error from server (NotFound): ingressclasses.networking.k8s.io "${parsed.name}" not found`
    )
  }
  if (resourceType === 'gatewayclasses') {
    if (!parsed.name) {
      return error(`error: you must specify the name of the resource to describe`)
    }
    const describeOutput = getGatewayClassDescribeOutput(state, parsed.name)
    if (describeOutput != null) {
      return success(describeOutput)
    }
    return error(
      `Error from server (NotFound): gatewayclasses.gateway.networking.k8s.io "${parsed.name}" not found`
    )
  }
  if (resourceType === 'gateways') {
    if (!parsed.name) {
      return error(`error: you must specify the name of the resource to describe`)
    }
    const describeOutput = getGatewayDescribeOutput(state, parsed.name)
    if (describeOutput != null) {
      return success(describeOutput)
    }
    return error(
      `Error from server (NotFound): gateways.gateway.networking.k8s.io "${parsed.name}" not found`
    )
  }
  if (resourceType === 'httproutes') {
    if (!parsed.name) {
      return error(`error: you must specify the name of the resource to describe`)
    }
    const describeOutput = getHttpRouteDescribeOutput(state, parsed.name)
    if (describeOutput != null) {
      return success(describeOutput)
    }
    return error(
      `Error from server (NotFound): httproutes.gateway.networking.k8s.io "${parsed.name}" not found`
    )
  }
  const config = DESCRIBE_CONFIG[resourceType]
  if (!config) {
    return error(
      `error: the server doesn't have a resource type "${resourceType}"`
    )
  }
  const canDescribeWithoutName = config.allowsDescribeWithoutName === true
  if (!parsed.name && !parsed.selector && !canDescribeWithoutName) {
    return error(`error: you must specify the name of the resource to describe`)
  }

  const allNamespacesFlag =
    parsed.flags['all-namespaces'] === true || parsed.flags['A'] === true
  const effectiveNamespace = parsed.namespace ?? 'default'
  const filterNamespace = allNamespacesFlag ? undefined : effectiveNamespace
  const collection = state[config.items] as {
    items: DescribeableResource[]
  }
  const isClusterScoped = config.isClusterScoped === true
  const filteredResources = applyFilters(
    collection.items,
    filterNamespace,
    parsed.selector,
    isClusterScoped,
    parsed.name
  )
  const resourcesToDescribe = sortDescribeResources(filteredResources)

  if (parsed.name && resourcesToDescribe.length === 0) {
    const reference = getNotFoundResourceReference(resourceType)
    return error(
      `Error from server (NotFound): ${reference} "${parsed.name}" not found`
    )
  }
  if (!parsed.name && resourcesToDescribe.length === 0) {
    return success(
      noResourcesMessage(
        allNamespacesFlag ? undefined : effectiveNamespace,
        isClusterScoped
      )
    )
  }

  const describeOutput = resourcesToDescribe
    .map((resource) => {
      return config.formatter(resource, state, resolvedDependencies)
    })
    .join('\n\n')
  return success(describeOutput)
}
