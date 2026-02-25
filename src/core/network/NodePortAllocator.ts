import type { Service } from '../cluster/ressources/Service'

const DEFAULT_NODE_PORT_MIN = 30000
const DEFAULT_NODE_PORT_MAX = 32767

interface NodePortAllocatorOptions {
  min?: number
  max?: number
}

const servicePortKey = (
  service: Service,
  servicePort: number,
  protocol: string
): string => {
  return `${service.metadata.namespace}/${service.metadata.name}:${servicePort}/${protocol}`
}

const baseCandidateFromKey = (key: string, min: number, size: number): number => {
  let hash = 0
  for (let index = 0; index < key.length; index++) {
    hash = (hash << 5) - hash + key.charCodeAt(index)
    hash = hash & hash
  }
  return min + (Math.abs(hash) % size)
}

export interface NodePortAllocator {
  assign: (service: Service, servicePort: number, protocol: string) => number
  reserve: (service: Service, nodePort: number, servicePort: number, protocol: string) => void
  releaseService: (service: Service) => void
}

export const createNodePortAllocator = (
  options: NodePortAllocatorOptions = {}
): NodePortAllocator => {
  const min = options.min ?? DEFAULT_NODE_PORT_MIN
  const max = options.max ?? DEFAULT_NODE_PORT_MAX
  const size = max - min + 1

  const assignedByKey = new Map<string, number>()
  const usedNodePorts = new Set<number>()

  const assign = (service: Service, servicePort: number, protocol: string): number => {
    const key = servicePortKey(service, servicePort, protocol)
    const existing = assignedByKey.get(key)
    if (existing != null) {
      return existing
    }

    let candidate = baseCandidateFromKey(key, min, size)
    let attempts = 0
    while (usedNodePorts.has(candidate) && attempts < size) {
      attempts = attempts + 1
      candidate = min + ((candidate - min + 1) % size)
    }

    if (usedNodePorts.has(candidate)) {
      throw new Error('NodePort allocation exhausted')
    }

    usedNodePorts.add(candidate)
    assignedByKey.set(key, candidate)
    return candidate
  }

  const reserve = (
    service: Service,
    nodePort: number,
    servicePort: number,
    protocol: string
  ): void => {
    const key = servicePortKey(service, servicePort, protocol)
    assignedByKey.set(key, nodePort)
    usedNodePorts.add(nodePort)
  }

  const releaseService = (service: Service): void => {
    const prefix = `${service.metadata.namespace}/${service.metadata.name}:`
    const matchingKeys: string[] = []
    for (const key of assignedByKey.keys()) {
      if (key.startsWith(prefix)) {
        matchingKeys.push(key)
      }
    }

    for (const key of matchingKeys) {
      const nodePort = assignedByKey.get(key)
      if (nodePort != null) {
        usedNodePorts.delete(nodePort)
      }
      assignedByKey.delete(key)
    }
  }

  return {
    assign,
    reserve,
    releaseService
  }
}
