import type { Service } from '../cluster/ressources/Service'

const SERVICE_CIDR_PREFIX = '10.96'

const serviceKey = (service: Service): string => {
  return `${service.metadata.namespace}/${service.metadata.name}`
}

const baseCandidateFromKey = (
  key: string
): { thirdOctet: number; fourthOctet: number } => {
  let hash = 0
  for (let index = 0; index < key.length; index++) {
    hash = (hash << 5) - hash + key.charCodeAt(index)
    hash = hash & hash
  }
  return {
    thirdOctet: (Math.abs(hash) % 240) + 10,
    fourthOctet: (Math.abs(hash >> 4) % 240) + 10
  }
}

const formatIp = (thirdOctet: number, fourthOctet: number): string => {
  return `${SERVICE_CIDR_PREFIX}.${thirdOctet}.${fourthOctet}`
}

export interface ServiceIpAllocator {
  assign: (service: Service) => string
  release: (service: Service) => void
  reserve: (service: Service) => void
}

export const createServiceIpAllocator = (): ServiceIpAllocator => {
  const assignedByServiceKey = new Map<string, string>()
  const usedIps = new Set<string>()

  const assign = (service: Service): string => {
    const key = serviceKey(service)
    const existing = assignedByServiceKey.get(key)
    if (existing != null) {
      return existing
    }

    const base = baseCandidateFromKey(key)
    let thirdOctet = base.thirdOctet
    let fourthOctet = base.fourthOctet
    let candidate = formatIp(thirdOctet, fourthOctet)
    let attempt = 0
    while (usedIps.has(candidate)) {
      attempt = attempt + 1
      thirdOctet = ((base.thirdOctet + attempt) % 240) + 10
      fourthOctet = ((base.fourthOctet + attempt * 7) % 240) + 10
      candidate = formatIp(thirdOctet, fourthOctet)
    }

    usedIps.add(candidate)
    assignedByServiceKey.set(key, candidate)
    return candidate
  }

  const release = (service: Service): void => {
    const key = serviceKey(service)
    const ip = assignedByServiceKey.get(key)
    if (ip == null) {
      return
    }
    assignedByServiceKey.delete(key)
    usedIps.delete(ip)
  }

  const reserve = (service: Service): void => {
    const existingClusterIp = service.spec.clusterIP
    if (existingClusterIp == null || existingClusterIp === 'None') {
      return
    }
    const key = serviceKey(service)
    assignedByServiceKey.set(key, existingClusterIp)
    usedIps.add(existingClusterIp)
  }

  return {
    assign,
    release,
    reserve
  }
}
