import { describe, expect, it } from 'vitest'
import type { Service } from '../../../src/core/cluster/ressources/Service'
import { createNodePortAllocator } from '../../../src/core/network/NodePortAllocator'

const makeService = (args: { name: string; namespace?: string }): Service => {
  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: {
      name: args.name,
      namespace: args.namespace ?? 'default',
      creationTimestamp: '2024-01-01T00:00:00.000Z'
    },
    spec: {
      ports: [{ protocol: 'TCP', port: 80 }]
    }
  }
}

describe('NodePortAllocator', () => {
  it('keeps reserve idempotent for the same service key', () => {
    const allocator = createNodePortAllocator()
    const service = makeService({ name: 'web' })

    expect(() => {
      allocator.reserve(service, 30080, 80, 'TCP')
      allocator.reserve(service, 30080, 80, 'TCP')
    }).not.toThrow()
  })

  it('rejects reserving an already used nodePort for another service key', () => {
    const allocator = createNodePortAllocator()
    const firstService = makeService({ name: 'api' })
    const secondService = makeService({ name: 'frontend' })

    allocator.reserve(firstService, 30080, 80, 'TCP')

    expect(() => {
      allocator.reserve(secondService, 30080, 80, 'TCP')
    }).toThrow('NodePort 30080 is already reserved')
  })

  it('allows re-reserving the same key with a new nodePort', () => {
    const allocator = createNodePortAllocator()
    const service = makeService({ name: 'api' })

    allocator.reserve(service, 30080, 80, 'TCP')
    allocator.reserve(service, 30090, 80, 'TCP')

    const assigned = allocator.assign(makeService({ name: 'other' }), 80, 'TCP')
    expect(assigned).not.toBe(30080)
    expect(assigned).not.toBe(30090)
  })
})
