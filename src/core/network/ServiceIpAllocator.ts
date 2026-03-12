import type { Service } from '../cluster/ressources/Service'

const SERVICE_CIDR_PREFIX = '10.96'
const OCTET_RANGE_START = 10
const OCTET_RANGE_SIZE = 240
const SERVICE_IP_POOL_SIZE = OCTET_RANGE_SIZE * OCTET_RANGE_SIZE

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
    thirdOctet: (Math.abs(hash) % OCTET_RANGE_SIZE) + OCTET_RANGE_START,
    fourthOctet: (Math.abs(hash >> 4) % OCTET_RANGE_SIZE) + OCTET_RANGE_START
  }
}

const formatIp = (thirdOctet: number, fourthOctet: number): string => {
  return `${SERVICE_CIDR_PREFIX}.${thirdOctet}.${fourthOctet}`
}

const toPoolIndex = (thirdOctet: number, fourthOctet: number): number => {
  return (
    (thirdOctet - OCTET_RANGE_START) * OCTET_RANGE_SIZE +
    (fourthOctet - OCTET_RANGE_START)
  )
}

const fromPoolIndex = (
  index: number
): { thirdOctet: number; fourthOctet: number } => {
  return {
    thirdOctet: Math.floor(index / OCTET_RANGE_SIZE) + OCTET_RANGE_START,
    fourthOctet: (index % OCTET_RANGE_SIZE) + OCTET_RANGE_START
  }
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
    const baseIndex = toPoolIndex(base.thirdOctet, base.fourthOctet)
    let attempt = 0
    while (attempt < SERVICE_IP_POOL_SIZE) {
      const candidateIndex = (baseIndex + attempt) % SERVICE_IP_POOL_SIZE
      const candidateOctets = fromPoolIndex(candidateIndex)
      const candidate = formatIp(
        candidateOctets.thirdOctet,
        candidateOctets.fourthOctet
      )
      if (!usedIps.has(candidate)) {
        usedIps.add(candidate)
        assignedByServiceKey.set(key, candidate)
        return candidate
      }
      attempt = attempt + 1
    }
    throw new Error('No available Service cluster IP addresses in allocation range')
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
