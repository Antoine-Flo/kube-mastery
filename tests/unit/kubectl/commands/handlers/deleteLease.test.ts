import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleDelete } from '../../../../../src/core/kubectl/commands/handlers/delete'
import { createLease } from '../../../../../src/core/cluster/ressources/Lease'
import {
  createApiServerFacade,
  type ApiServerFacade
} from '../../../../../src/core/api/ApiServerFacade'
import {
  createFileSystem,
  type FileSystem
} from '../../../../../src/core/filesystem/FileSystem'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'

describe('kubectl delete handler - leases', () => {
  let apiServer: ApiServerFacade
  let eventBus: ApiServerFacade['eventBus']
  let fileSystem: FileSystem

  beforeEach(() => {
    apiServer = createApiServerFacade()
    eventBus = apiServer.eventBus
    fileSystem = createFileSystem()
  })

  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => ({
    action: 'delete',
    resource: 'leases',
    flags: {},
    ...overrides
  })

  describe('deleting leases', () => {
    it('should delete lease by name', () => {
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
        namespace: 'kube-node-lease'
      })
      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      expect(result.value).toContain('lease "node-lease-1" deleted')
      expect(result.value).toContain('kube-node-lease')

      const findResult = apiServer.findResource(
        'Lease',
        'node-lease-1',
        'kube-node-lease'
      )
      expect(findResult.ok).toBe(false)
    })

    it('should emit LeaseDeleted event', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      apiServer.createResource('Lease', lease)

      const subscriber = vi.fn()
      eventBus.subscribe('LeaseDeleted', subscriber)

      const parsed = createParsedCommand({
        name: 'node-lease-1',
        namespace: 'kube-node-lease'
      })
      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(true)
      expect(subscriber).toHaveBeenCalled()
      const event = subscriber.mock.calls[0][0]
      expect(event.type).toBe('LeaseDeleted')
      expect(event.payload.name).toBe('node-lease-1')
      expect(event.payload.namespace).toBe('kube-node-lease')
    })

    it('should return error when lease not found', () => {
      const parsed = createParsedCommand({
        name: 'non-existent-lease',
        namespace: 'kube-node-lease'
      })
      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('NotFound')
        expect(result.error).toContain('non-existent-lease')
      }
    })

    it('should delete lease from default namespace when namespace not specified', () => {
      const lease = createLease({
        name: 'lease-1',
        namespace: 'default',
        spec: {
          holderIdentity: 'holder-1',
          leaseDurationSeconds: 40
        }
      })

      apiServer.createResource('Lease', lease)

      const parsed = createParsedCommand({
        name: 'lease-1'
      })
      const result = handleDelete(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      expect(result.value).toContain('lease "lease-1" deleted')
      expect(result.value).toContain('default')

      const findResult = apiServer.findResource('Lease', 'lease-1', 'default')
      expect(findResult.ok).toBe(false)
    })
  })

  describe('declarative delete with -f', () => {
    it('should delete lease declared in manifest file', () => {
      const lease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40
        }
      })

      apiServer.createResource('Lease', lease)
      fileSystem.createFile('lease.yaml')
      fileSystem.writeFile(
        'lease.yaml',
        `apiVersion: coordination.k8s.io/v1
kind: Lease
metadata:
  name: node-lease-1
  namespace: kube-node-lease
spec:
  holderIdentity: node-1
  leaseDurationSeconds: 40
`
      )

      const parsed = createParsedCommand({
        flags: { f: 'lease.yaml' }
      })

      const result = handleDelete(apiServer, parsed, fileSystem)
      expect(result.ok).toBe(true)
      if (!result.ok) {
        return
      }

      expect(result.value).toContain('lease "node-lease-1" deleted')
      expect(result.value).toContain('kube-node-lease')

      const findResult = apiServer.findResource(
        'Lease',
        'node-lease-1',
        'kube-node-lease'
      )
      expect(findResult.ok).toBe(false)
    })

    it('should return not found for manifest resource that does not exist', () => {
      fileSystem.createFile('missing-lease.yaml')
      fileSystem.writeFile(
        'missing-lease.yaml',
        `apiVersion: coordination.k8s.io/v1
kind: Lease
metadata:
  name: missing-lease
  namespace: kube-node-lease
spec:
  holderIdentity: node-1
  leaseDurationSeconds: 40
`
      )

      const parsed = createParsedCommand({
        flags: { f: 'missing-lease.yaml' }
      })

      const result = handleDelete(apiServer, parsed, fileSystem)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('NotFound')
        expect(result.error).toContain('missing-lease')
      }
    })
  })
})
