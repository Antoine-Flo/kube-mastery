import type { ApiServerFacade } from '../api/ApiServerFacade'
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
  apiServer: ApiServerFacade
): SimNetworkRuntime => {
  const controller = createNetworkController(apiServer)
  const state = controller.getState()
  const dnsResolver = createDnsResolver(state, apiServer)
  const trafficEngine = createTrafficEngine(state, dnsResolver, apiServer)
  controller.start()
  return {
    controller,
    state,
    dnsResolver,
    trafficEngine
  }
}
