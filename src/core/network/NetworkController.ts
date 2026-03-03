import type { ClusterState } from '../cluster/ClusterState'
import type { EventBus } from '../cluster/events/EventBus'
import type { ServiceDeletedEvent } from '../cluster/events/types'
import type { Pod } from '../cluster/ressources/Pod'
import type { Service } from '../cluster/ressources/Service'
import { startPeriodicResync } from '../cluster/controllers/helpers'
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
        targetPort
      })
    }
  }
  return endpoints
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

export const createNetworkController = (
  eventBus: EventBus,
  clusterState: ClusterState,
  options: NetworkControllerOptions = {}
): NetworkController => {
  const networkState = createNetworkState()
  const serviceIpAllocator = createServiceIpAllocator()
  const nodePortAllocator = createNodePortAllocator()
  let started = false
  let unsubscribeEvents: (() => void) | undefined
  let stopResync: (() => void) | undefined

  const reconcileServices = (): void => {
    const pods = clusterState.getPods()
    const services = clusterState.getServices()
    for (const service of services) {
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
        clusterState.updateService(
          service.metadata.name,
          service.metadata.namespace,
          () => allocatedService
        )
      }

      const effectiveService = serviceChanged(service, allocatedService)
        ? allocatedService
        : service

      networkState.upsertServiceRuntime({
        namespace: effectiveService.metadata.namespace,
        serviceName: effectiveService.metadata.name,
        serviceType: effectiveService.spec.type ?? 'ClusterIP',
        ...(effectiveService.spec.clusterIP != null && {
          clusterIP: effectiveService.spec.clusterIP
        }),
        ports: effectiveService.spec.ports.map((port) => ({
          name: port.name,
          protocol: port.protocol ?? 'TCP',
          port: port.port,
          targetPort: port.targetPort ?? port.port,
          ...(port.nodePort != null && { nodePort: port.nodePort })
        })),
        endpoints: getServiceEndpoints(effectiveService, pods)
      })
    }
  }

  const onEvent = (event: { type: AppEventType }): void => {
    if (event.type === 'ServiceDeleted') {
      const deleted = event as ServiceDeletedEvent
      serviceIpAllocator.release(deleted.payload.deletedService)
      nodePortAllocator.releaseService(deleted.payload.deletedService)
      networkState.removeServiceRuntime(
        deleted.payload.namespace,
        deleted.payload.name
      )
      reconcileServices()
      return
    }
    reconcileServices()
  }

  const initialSync = (): void => {
    reconcileServices()
  }

  const resyncAll = (): void => {
    reconcileServices()
  }

  const start = (): void => {
    if (started) {
      return
    }
    started = true
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
  }

  return {
    start,
    stop,
    initialSync,
    resyncAll,
    getState: () => networkState
  }
}
