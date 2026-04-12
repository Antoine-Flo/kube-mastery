import type { ApiServerFacade } from '../api/ApiServerFacade'
import type { ServiceDeletedEvent } from '../cluster/events/types'
import {
  createServiceEndpointSlice,
  type EndpointSlice
} from '../cluster/ressources/EndpointSlice'
import {
  createServiceEndpoints,
  type Endpoints
} from '../cluster/ressources/Endpoints'
import { isPodTerminating, type Pod } from '../cluster/ressources/Pod'
import type { Service } from '../cluster/ressources/Service'
import { startPeriodicResync } from '../control-plane/controller-runtime/helpers'
import {
  createWorkQueue,
  type WorkQueue
} from '../control-plane/controller-runtime/WorkQueue'
import type { AppEventType } from '../events/AppEvent'
import { createNodePortAllocator } from './NodePortAllocator'
import {
  createNetworkState,
  type NetworkState,
  type SimServiceEndpoint
} from './NetworkState'
import { createServiceIpAllocator } from './ServiceIpAllocator'

interface NetworkControllerOptions {
  resyncIntervalMs?: number
}

export interface NetworkController {
  start: () => void
  stop: () => void
  initialSync: () => void
  resyncAll: () => void
  getState: () => NetworkState
}

const NETWORK_RELEVANT_EVENTS: AppEventType[] = [
  'PodCreated',
  'PodUpdated',
  'PodDeleted',
  'ServiceCreated',
  'ServiceUpdated',
  'ServiceDeleted'
]

const serviceNeedsClusterIpAllocation = (service: Service): boolean => {
  const serviceType = service.spec.type ?? 'ClusterIP'
  if (serviceType === 'ExternalName') {
    return false
  }
  return service.spec.clusterIP == null
}

const serviceNeedsNodePortAllocation = (service: Service): boolean => {
  const serviceType = service.spec.type ?? 'ClusterIP'
  if (serviceType !== 'NodePort' && serviceType !== 'LoadBalancer') {
    return false
  }
  return service.spec.ports.some((port) => port.nodePort == null)
}

const resolveTargetPortForPod = (
  serviceTargetPort: number | string | undefined,
  servicePort: number,
  pod: Pod
): number | undefined => {
  if (typeof serviceTargetPort === 'number') {
    return serviceTargetPort
  }
  if (typeof serviceTargetPort === 'string') {
    for (const container of pod.spec.containers) {
      const matchingPort = container.ports?.find((port) => {
        return port.containerPort.toString() === serviceTargetPort
      })
      if (matchingPort != null) {
        return matchingPort.containerPort
      }
    }
    return undefined
  }
  return servicePort
}

const resolveResponseProfileFromImage = (
  imageName: string | undefined
): 'nginx' | 'generic' => {
  if (imageName == null) {
    return 'generic'
  }
  if (imageName.toLowerCase().includes('nginx')) {
    return 'nginx'
  }
  return 'generic'
}

const resolveEndpointResponseProfile = (
  pod: Pod,
  targetPort: number
): 'nginx' | 'generic' => {
  for (const container of pod.spec.containers) {
    const hasMatchingPort = (container.ports ?? []).some((port) => {
      return port.containerPort === targetPort
    })
    if (hasMatchingPort) {
      return resolveResponseProfileFromImage(container.image)
    }
  }
  const firstContainer = pod.spec.containers[0]
  return resolveResponseProfileFromImage(firstContainer?.image)
}

const serviceSelectsPod = (service: Service, pod: Pod): boolean => {
  const selector = service.spec.selector
  if (selector == null) {
    return false
  }
  const labels = pod.metadata.labels ?? {}
  return Object.entries(selector).every(([key, value]) => labels[key] === value)
}

const getServiceEndpoints = (
  service: Service,
  pods: Pod[]
): SimServiceEndpoint[] => {
  const endpoints: SimServiceEndpoint[] = []
  for (const pod of pods) {
    if (!serviceSelectsPod(service, pod)) {
      continue
    }
    if (pod.status.phase !== 'Running' || pod.status.podIP == null) {
      continue
    }
    if (isPodTerminating(pod)) {
      continue
    }

    for (const servicePort of service.spec.ports) {
      const targetPort = resolveTargetPortForPod(
        servicePort.targetPort,
        servicePort.port,
        pod
      )
      if (targetPort == null) {
        continue
      }
      endpoints.push({
        podName: pod.metadata.name,
        namespace: pod.metadata.namespace,
        podIP: pod.status.podIP,
        ...(pod.spec.nodeName != null && { nodeName: pod.spec.nodeName }),
        targetPort,
        responseProfile: resolveEndpointResponseProfile(pod, targetPort)
      })
    }
  }
  return endpoints
}

const endpointsChanged = (previous: Endpoints, next: Endpoints): boolean => {
  const previousSubsets = previous.subsets ?? []
  const nextSubsets = next.subsets ?? []
  return JSON.stringify(previousSubsets) !== JSON.stringify(nextSubsets)
}

const endpointSliceChanged = (
  previous: EndpointSlice,
  next: EndpointSlice
): boolean => {
  const previousPayload = {
    ports: previous.ports ?? [],
    endpoints: previous.endpoints
  }
  const nextPayload = {
    ports: next.ports ?? [],
    endpoints: next.endpoints
  }
  return JSON.stringify(previousPayload) !== JSON.stringify(nextPayload)
}

const isSliceForService = (
  endpointSlice: EndpointSlice,
  serviceName: string
): boolean => {
  return (
    endpointSlice.metadata.labels?.['kubernetes.io/service-name'] ===
    serviceName
  )
}

const withNetworkAllocations = (
  service: Service,
  serviceIpAllocator: ReturnType<typeof createServiceIpAllocator>,
  nodePortAllocator: ReturnType<typeof createNodePortAllocator>
): Service => {
  const withClusterIp = serviceNeedsClusterIpAllocation(service)
    ? {
        ...service,
        spec: {
          ...service.spec,
          clusterIP: serviceIpAllocator.assign(service)
        }
      }
    : service

  if (!serviceNeedsNodePortAllocation(withClusterIp)) {
    return withClusterIp
  }

  return {
    ...withClusterIp,
    spec: {
      ...withClusterIp.spec,
      ports: withClusterIp.spec.ports.map((port) => {
        if (port.nodePort != null) {
          return port
        }
        const protocol = port.protocol ?? 'TCP'
        return {
          ...port,
          nodePort: nodePortAllocator.assign(withClusterIp, port.port, protocol)
        }
      })
    }
  }
}

const serviceChanged = (left: Service, right: Service): boolean => {
  return JSON.stringify(left.spec) !== JSON.stringify(right.spec)
}

const makeServiceKey = (namespace: string, name: string): string => {
  return `${namespace}/${name}`
}

const parseServiceKey = (
  serviceKey: string
): { namespace: string; name: string } => {
  const [namespace, name] = serviceKey.split('/')
  return { namespace, name }
}

export const createNetworkController = (
  apiServer: ApiServerFacade,
  options: NetworkControllerOptions = {}
): NetworkController => {
  const eventBus = apiServer.getEventBus()
  const networkState = createNetworkState()
  const serviceIpAllocator = createServiceIpAllocator()
  const nodePortAllocator = createNodePortAllocator()
  let started = false
  let unsubscribeEvents: (() => void) | undefined
  let stopResync: (() => void) | undefined
  const serviceQueue: WorkQueue = createWorkQueue({ processDelay: 0 })

  const enqueueService = (namespace: string, name: string): void => {
    serviceQueue.add(makeServiceKey(namespace, name))
  }

  const enqueueAllServices = (): void => {
    for (const service of apiServer.listResources('Service')) {
      enqueueService(service.metadata.namespace, service.metadata.name)
    }
  }

  const reconcileServiceByKey = (serviceKey: string): void => {
    const { namespace, name } = parseServiceKey(serviceKey)
    const serviceResult = apiServer.findResource('Service', name, namespace)
    if (!serviceResult.ok || serviceResult.value == null) {
      networkState.removeServiceRuntime(namespace, name)
      apiServer.deleteResource('Endpoints', name, namespace)
      const endpointSlices = apiServer.listResources('EndpointSlice', namespace)
      for (const endpointSlice of endpointSlices) {
        if (!isSliceForService(endpointSlice, name)) {
          continue
        }
        apiServer.deleteResource(
          'EndpointSlice',
          endpointSlice.metadata.name,
          namespace
        )
      }
      return
    }

    const service = serviceResult.value
    const pods = apiServer.listResources('Pod')
    serviceIpAllocator.reserve(service)
    for (const port of service.spec.ports) {
      if (port.nodePort != null) {
        nodePortAllocator.reserve(
          service,
          port.nodePort,
          port.port,
          port.protocol ?? 'TCP'
        )
      }
    }

    const allocatedService = withNetworkAllocations(
      service,
      serviceIpAllocator,
      nodePortAllocator
    )
    if (serviceChanged(service, allocatedService)) {
      apiServer.updateResource(
        'Service',
        service.metadata.name,
        allocatedService,
        service.metadata.namespace
      )
    }

    const effectiveService = serviceChanged(service, allocatedService)
      ? allocatedService
      : service
    const serviceEndpoints = getServiceEndpoints(effectiveService, pods)

    networkState.upsertServiceRuntime({
      namespace: effectiveService.metadata.namespace,
      serviceName: effectiveService.metadata.name,
      serviceType: effectiveService.spec.type ?? 'ClusterIP',
      ...(effectiveService.spec.clusterIP != null && {
        clusterIP: effectiveService.spec.clusterIP
      }),
      ports: effectiveService.spec.ports.map((port) => ({
        name: port.name,
        protocol: (port.protocol ?? 'TCP') as 'TCP' | 'UDP' | 'SCTP',
        port: port.port,
        targetPort: port.targetPort ?? port.port,
        ...(port.nodePort != null && { nodePort: port.nodePort })
      })),
      endpoints: serviceEndpoints
    })

    const existingEndpoints = apiServer.findResource(
      'Endpoints',
      effectiveService.metadata.name,
      effectiveService.metadata.namespace
    )
    const nextEndpoints = createServiceEndpoints({
      serviceName: effectiveService.metadata.name,
      namespace: effectiveService.metadata.namespace,
      backends: serviceEndpoints,
      ...(existingEndpoints.ok && {
        creationTimestamp: existingEndpoints.value.metadata.creationTimestamp
      })
    })
    if (existingEndpoints.ok) {
      if (endpointsChanged(existingEndpoints.value, nextEndpoints)) {
        apiServer.updateResource(
          'Endpoints',
          effectiveService.metadata.name,
          nextEndpoints,
          effectiveService.metadata.namespace
        )
      }
    } else {
      apiServer.createResource(
        'Endpoints',
        nextEndpoints,
        effectiveService.metadata.namespace
      )
    }

    const existingEndpointSlice = apiServer
      .listResources('EndpointSlice', effectiveService.metadata.namespace)
      .find((endpointSlice) =>
        isSliceForService(endpointSlice, effectiveService.metadata.name)
      )
    const nextEndpointSlice = createServiceEndpointSlice({
      serviceName: effectiveService.metadata.name,
      namespace: effectiveService.metadata.namespace,
      backends: serviceEndpoints,
      ...(existingEndpointSlice != null && {
        name: existingEndpointSlice.metadata.name,
        creationTimestamp: existingEndpointSlice.metadata.creationTimestamp
      })
    })
    if (existingEndpointSlice != null) {
      if (endpointSliceChanged(existingEndpointSlice, nextEndpointSlice)) {
        apiServer.updateResource(
          'EndpointSlice',
          existingEndpointSlice.metadata.name,
          nextEndpointSlice,
          effectiveService.metadata.namespace
        )
      }
    } else {
      apiServer.createResource(
        'EndpointSlice',
        nextEndpointSlice,
        effectiveService.metadata.namespace
      )
    }
  }

  const onEvent = (event: { type: AppEventType; payload?: unknown }): void => {
    if (event.type === 'ServiceDeleted') {
      const deleted = event as ServiceDeletedEvent
      serviceIpAllocator.release(deleted.payload.deletedService)
      nodePortAllocator.releaseService(deleted.payload.deletedService)
      networkState.removeServiceRuntime(
        deleted.payload.namespace,
        deleted.payload.name
      )
      apiServer.deleteResource(
        'Endpoints',
        deleted.payload.name,
        deleted.payload.namespace
      )
      const endpointSlices = apiServer.listResources(
        'EndpointSlice',
        deleted.payload.namespace
      )
      for (const endpointSlice of endpointSlices) {
        if (!isSliceForService(endpointSlice, deleted.payload.name)) {
          continue
        }
        apiServer.deleteResource(
          'EndpointSlice',
          endpointSlice.metadata.name,
          deleted.payload.namespace
        )
      }
      return
    }

    if (event.type === 'ServiceCreated' || event.type === 'ServiceUpdated') {
      const payload = event.payload as {
        service?: { metadata: { namespace: string; name: string } }
      }
      if (payload.service != null) {
        enqueueService(
          payload.service.metadata.namespace,
          payload.service.metadata.name
        )
      }
      return
    }

    if (
      event.type === 'PodCreated' ||
      event.type === 'PodUpdated' ||
      event.type === 'PodDeleted'
    ) {
      const payload = event.payload as {
        pod?: Pod
        deletedPod?: Pod
      }
      const pod = payload.pod ?? payload.deletedPod
      if (pod == null) {
        enqueueAllServices()
        return
      }
      for (const service of apiServer.listResources(
        'Service',
        pod.metadata.namespace
      )) {
        if (!serviceSelectsPod(service, pod)) {
          continue
        }
        enqueueService(service.metadata.namespace, service.metadata.name)
      }
      return
    }
  }

  const initialSync = (): void => {
    enqueueAllServices()
  }

  const resyncAll = (): void => {
    enqueueAllServices()
  }

  const start = (): void => {
    if (started) {
      return
    }
    started = true
    serviceQueue.start((serviceKey) => {
      reconcileServiceByKey(serviceKey)
    })
    initialSync()
    const unsubscribers: Array<() => void> = []
    for (const eventType of NETWORK_RELEVANT_EVENTS) {
      const unsubscribe = eventBus.subscribe(
        eventType,
        onEvent as (event: unknown) => void
      )
      unsubscribers.push(unsubscribe)
    }
    unsubscribeEvents = () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe()
      }
    }
    stopResync = startPeriodicResync(options.resyncIntervalMs, resyncAll)
  }

  const stop = (): void => {
    if (!started) {
      return
    }
    started = false
    if (unsubscribeEvents != null) {
      unsubscribeEvents()
      unsubscribeEvents = undefined
    }
    if (stopResync != null) {
      stopResync()
      stopResync = undefined
    }
    serviceQueue.stop()
  }

  return {
    start,
    stop,
    initialSync,
    resyncAll,
    getState: () => networkState
  }
}
