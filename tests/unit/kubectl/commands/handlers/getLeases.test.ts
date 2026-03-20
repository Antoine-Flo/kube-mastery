import { beforeEach, describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createLease } from '../../../../../src/core/cluster/ressources/Lease'
import { handleGet } from '../../../../../src/core/kubectl/commands/handlers/get'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'

describe('kubectl get handler - leases', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>

  beforeEach(() => {
    apiServer = createApiServerFacade()
  })

  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => ({
    action: 'get',
    resource: 'leases',
    flags: {},
    ...overrides
  })

  describe('listing leases', () => {
    it('should list leases in default namespace', () => {
      const lease1 = createLease({
        name: 'lease-1',
        namespace: 'default',
        spec: {
          holderIdentity: 'holder-1',
          leaseDurationSeconds: 40,
          renewTime: '2024-01-01T00:00:00Z'
        }
      })
      const lease2 = createLease({
        name: 'lease-2',
        namespace: 'default',
        spec: {
          holderIdentity: 'holder-2',
          leaseDurationSeconds: 40,
          renewTime: '2024-01-01T00:00:00Z'
        }
      })

      apiServer.createResource('Lease', lease1)
      apiServer.createResource('Lease', lease2)

      const parsed = createParsedCommand()
      const result = handleGet(apiServer, parsed)

      expect(result).toContain('NAME')
      expect(result).toContain('HOLDER')
      expect(result).toContain('AGE')
      expect(result).toContain('lease-1')
      expect(result).toContain('lease-2')
      expect(result).toContain('holder-1')
      expect(result).toContain('holder-2')
    })

    it('should list leases in specific namespace', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40,
          renewTime: '2024-01-01T00:00:00Z'
        }
      })

      apiServer.createResource('Lease', lease)

      const parsed = createParsedCommand({
        namespace: 'kube-node-lease'
      })
      const result = handleGet(apiServer, parsed)

      expect(result).toContain('node-lease-1')
      expect(result).toContain('node-1')
    })

    it('should show <none> for lease without holderIdentity', () => {
      const lease = createLease({
        name: 'lease-no-holder',
        namespace: 'default',
        spec: {
          leaseDurationSeconds: 40
        }
      })

      apiServer.createResource('Lease', lease)

      const parsed = createParsedCommand()
      const result = handleGet(apiServer, parsed)

      expect(result).toContain('lease-no-holder')
      expect(result).toContain('<none>')
    })

    it('should return empty list when no leases exist', () => {
      const parsed = createParsedCommand({
        namespace: 'kube-node-lease'
      })
      const result = handleGet(apiServer, parsed)

      expect(result).toContain('No resources found')
      expect(result).toContain('kube-node-lease')
    })

    it('should filter leases by namespace', () => {
      const lease1 = createLease({
        name: 'lease-1',
        namespace: 'default',
        spec: {
          holderIdentity: 'holder-1',
          leaseDurationSeconds: 40
        }
      })
      const lease2 = createLease({
        name: 'lease-2',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'holder-2',
          leaseDurationSeconds: 40
        }
      })

      apiServer.createResource('Lease', lease1)
      apiServer.createResource('Lease', lease2)

      const parsed = createParsedCommand({
        namespace: 'kube-node-lease'
      })
      const result = handleGet(apiServer, parsed)

      expect(result).toContain('lease-2')
      expect(result).not.toContain('lease-1')
    })
  })

  describe('getting specific lease', () => {
    it('should get specific lease by name', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40,
          renewTime: '2024-01-01T00:00:00Z'
        }
      })

      apiServer.createResource('Lease', lease)

      const parsed = createParsedCommand({
        name: 'node-lease-1',
        namespace: 'kube-node-lease'
      })
      const result = handleGet(apiServer, parsed)

      expect(result).toContain('node-lease-1')
      expect(result).toContain('node-1')
    })

    it('should return "No resources found" when lease not found', () => {
      const parsed = createParsedCommand({
        name: 'non-existent-lease',
        namespace: 'kube-node-lease'
      })
      const result = handleGet(apiServer, parsed)

      // When a specific name is queried but not found, kubectl returns "No resources found"
      expect(result).toContain('No resources found')
      expect(result).toContain('kube-node-lease')
    })
  })

  describe('output formats', () => {
    it('should output in yaml format', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      apiServer.createResource('Lease', lease)

      const parsed = createParsedCommand({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        flags: { output: 'yaml' }
      })
      const result = handleGet(apiServer, parsed)

      expect(result).toContain('apiVersion: coordination.k8s.io/v1')
      expect(result).toContain('kind: Lease')
      expect(result).toContain('name: node-lease-1')
    })

    it('should output in json format', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      apiServer.createResource('Lease', lease)

      const parsed = createParsedCommand({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        flags: { output: 'json' }
      })
      const result = handleGet(apiServer, parsed)

      const json = JSON.parse(result)
      expect(json.apiVersion).toBe('coordination.k8s.io/v1')
      expect(json.kind).toBe('Lease')
      expect(json.metadata.name).toBe('node-lease-1')
    })
  })
})
