import type { ClusterState } from '../cluster/ClusterState'
import type { EventBus } from '../cluster/events/EventBus'
import { createDnsResolver, type DnsResolver } from './DnsResolver'
import {
  createNetworkController,
  type NetworkController
} from './NetworkController'
import { type NetworkState } from './NetworkState'
import { createTrafficEngine, type TrafficEngine } from './TrafficEngine'

export interface SimNetworkRuntime {
  controller: NetworkController
  state: NetworkState
  dnsResolver: DnsResolver
  trafficEngine: TrafficEngine
}

export const initializeSimNetworkRuntime = (
  eventBus: EventBus,
  clusterState: ClusterState
): SimNetworkRuntime => {
  const controller = createNetworkController(eventBus, clusterState)
  const state = controller.getState()
  const dnsResolver = createDnsResolver(state)
  const trafficEngine = createTrafficEngine(state, dnsResolver)
  controller.start()
  return {
    controller,
    state,
    dnsResolver,
    trafficEngine
  }
}
