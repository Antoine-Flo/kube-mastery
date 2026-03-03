import type { Pod } from '../ressources/Pod'

const POD_CIDR_PREFIX = '10.244'

const podKey = (pod: Pod): string => {
  return `${pod.metadata.namespace}/${pod.metadata.name}`
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
  return `${POD_CIDR_PREFIX}.${thirdOctet}.${fourthOctet}`
}

export interface SimPodIpAllocator {
  assign: (pod: Pod) => string
  release: (pod: Pod) => void
  reserve: (pod: Pod) => void
}

export const createSimPodIpAllocator = (): SimPodIpAllocator => {
  const assignedByPodKey = new Map<string, string>()
  const usedIps = new Set<string>()

  const assign = (pod: Pod): string => {
    const key = podKey(pod)
    const existing = assignedByPodKey.get(key)
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
    assignedByPodKey.set(key, candidate)
    return candidate
  }

  const release = (pod: Pod): void => {
    const key = podKey(pod)
    const ip = assignedByPodKey.get(key)
    if (ip == null) {
      return
    }
    assignedByPodKey.delete(key)
    usedIps.delete(ip)
  }

  const reserve = (pod: Pod): void => {
    const existingPodIp = pod.status.podIP
    if (existingPodIp == null) {
      return
    }
    const key = podKey(pod)
    assignedByPodKey.set(key, existingPodIp)
    usedIps.add(existingPodIp)
  }

  return {
    assign,
    release,
    reserve
  }
}
