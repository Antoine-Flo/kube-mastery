import type { Service } from '../cluster/ressources/Service'

export interface SimServiceEndpoint {
  podName: string
  namespace: string
  podIP: string
  nodeName?: string
  targetPort: number
}

export interface SimServicePortRuntime {
  name?: string
  protocol: 'TCP' | 'UDP' | 'SCTP'
  port: number
  targetPort: number | string
  nodePort?: number
}

export interface SimServiceRuntime {
  namespace: string
  serviceName: string
  serviceType: NonNullable<Service['spec']['type']>
  clusterIP?: string
  ports: SimServicePortRuntime[]
  endpoints: SimServiceEndpoint[]
}

const serviceKey = (namespace: string, serviceName: string): string => {
  return `${namespace}/${serviceName}`
}

export interface NetworkState {
  upsertServiceRuntime: (runtime: SimServiceRuntime) => void
  removeServiceRuntime: (namespace: string, serviceName: string) => void
  getServiceRuntime: (
    namespace: string,
    serviceName: string
  ) => SimServiceRuntime | undefined
  listServiceRuntimes: () => SimServiceRuntime[]
  findServiceByClusterIp: (clusterIp: string) => SimServiceRuntime | undefined
  findServiceByNodePort: (nodePort: number) => SimServiceRuntime | undefined
}

export const createNetworkState = (): NetworkState => {
  const runtimeByServiceKey = new Map<string, SimServiceRuntime>()

  const upsertServiceRuntime = (runtime: SimServiceRuntime): void => {
    runtimeByServiceKey.set(
      serviceKey(runtime.namespace, runtime.serviceName),
      {
        ...runtime,
        ports: [...runtime.ports],
        endpoints: [...runtime.endpoints]
      }
    )
  }

  const removeServiceRuntime = (
    namespace: string,
    serviceName: string
  ): void => {
    runtimeByServiceKey.delete(serviceKey(namespace, serviceName))
  }

  const getServiceRuntime = (
    namespace: string,
    serviceName: string
  ): SimServiceRuntime | undefined => {
    return runtimeByServiceKey.get(serviceKey(namespace, serviceName))
  }

  const listServiceRuntimes = (): SimServiceRuntime[] => {
    return [...runtimeByServiceKey.values()]
  }

  const findServiceByClusterIp = (
    clusterIp: string
  ): SimServiceRuntime | undefined => {
    for (const runtime of runtimeByServiceKey.values()) {
      if (runtime.clusterIP === clusterIp) {
        return runtime
      }
    }
    return undefined
  }

  const findServiceByNodePort = (
    nodePort: number
  ): SimServiceRuntime | undefined => {
    for (const runtime of runtimeByServiceKey.values()) {
      const hasNodePort = runtime.ports.some(
        (port) => port.nodePort === nodePort
      )
      if (hasNodePort) {
        return runtime
      }
    }
    return undefined
  }

  return {
    upsertServiceRuntime,
    removeServiceRuntime,
    getServiceRuntime,
    listServiceRuntimes,
    findServiceByClusterIp,
    findServiceByNodePort
  }
}
