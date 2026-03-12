import { describe, expect, it } from 'vitest'
import type { Service } from '../../../src/core/cluster/ressources/Service'
import { createServiceIpAllocator } from '../../../src/core/network/ServiceIpAllocator'

const makeService = (args: {
  name: string
  namespace?: string
  clusterIP?: string
}): Service => {
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: args.name,
      namespace: args.namespace ?? 'default',
      creationTimestamp: '2024-01-01T00:00:00.000Z'
    },
    spec: {
      ports: [{ protocol: 'TCP', port: 80 }],
      ...(args.clusterIP != null ? { clusterIP: args.clusterIP } : {})
    }
  }
}

const oldSequenceBaseFromKey = (
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

const oldSequenceIpForAttempt = (
  base: { thirdOctet: number; fourthOctet: number },
  attempt: number
): string => {
  const thirdOctet = ((base.thirdOctet + attempt) % 240) + 10
  const fourthOctet = ((base.fourthOctet + attempt * 7) % 240) + 10
  return `10.96.${thirdOctet}.${fourthOctet}`
}

describe('ServiceIpAllocator', () => {
  it('should not get stuck when the old 240-IP collision cycle is exhausted', () => {
    const allocator = createServiceIpAllocator()
    const target = makeService({ name: 'target-service', namespace: 'default' })
    const key = `${target.metadata.namespace}/${target.metadata.name}`
    const base = oldSequenceBaseFromKey(key)
    const blockedIps = new Set<string>()

    for (let attempt = 0; attempt < 240; attempt++) {
      const blockedIp = oldSequenceIpForAttempt(base, attempt)
      blockedIps.add(blockedIp)
      allocator.reserve(
        makeService({
          name: `reserved-${attempt}`,
          namespace: 'default',
          clusterIP: blockedIp
        })
      )
    }

    const assigned = allocator.assign(target)
    expect(blockedIps.has(assigned)).toBe(false)
    expect(assigned.startsWith('10.96.')).toBe(true)
  })

  it('should throw a clear error when the Service IP pool is exhausted', () => {
    const allocator = createServiceIpAllocator()

    for (let thirdOctet = 10; thirdOctet <= 249; thirdOctet++) {
      for (let fourthOctet = 10; fourthOctet <= 249; fourthOctet++) {
        allocator.reserve(
          makeService({
            name: `reserved-${thirdOctet}-${fourthOctet}`,
            namespace: 'default',
            clusterIP: `10.96.${thirdOctet}.${fourthOctet}`
          })
        )
      }
    }

    expect(() => {
      allocator.assign(makeService({ name: 'unassignable-service' }))
    }).toThrow('No available Service cluster IP addresses in allocation range')
  })
})
