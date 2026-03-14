import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleScale } from '../../../../../src/core/kubectl/commands/handlers/scale'
import { createDeployment } from '../../../../../src/core/cluster/ressources/Deployment'
import { createReplicaSet } from '../../../../../src/core/cluster/ressources/ReplicaSet'
import { createNamespace } from '../../../../../src/core/cluster/ressources/Namespace'
import {
  createApiServerFacade,
  type ApiServerFacade
} from '../../../../../src/core/api/ApiServerFacade'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'

describe('kubectl scale handler', () => {
  let apiServer: ApiServerFacade
  let eventBus: ApiServerFacade['eventBus']

  beforeEach(() => {
    apiServer = createApiServerFacade()
    eventBus = apiServer.eventBus
  })

  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => ({
    action: 'scale',
    resource: 'deployments',
    flags: {},
    ...overrides
  })

  describe('validation', () => {
    it('should return error when replicas flag is not provided', () => {
      const parsed = createParsedCommand({
        name: 'my-deployment',
        replicas: undefined
      })

      const result = handleScale(apiServer, parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('--replicas=COUNT')
      }
    })

    it('should return error when replicas is negative', () => {
      const parsed = createParsedCommand({
        name: 'my-deployment',
        replicas: -1
      })

      const result = handleScale(apiServer, parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('--replicas=COUNT')
      }
    })

    it('should return error when name is not provided', () => {
      const parsed = createParsedCommand({
        name: undefined,
        replicas: 3
      })

      const result = handleScale(apiServer, parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('must specify the name')
      }
    })

    it('should return error for non-scalable resource types', () => {
      const parsed = createParsedCommand({
        name: 'my-pod',
        resource: 'pods',
        replicas: 3
      })

      const result = handleScale(apiServer, parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('not scalable')
      }
    })

    it('should return error for configmaps', () => {
      const parsed = createParsedCommand({
        name: 'my-config',
        resource: 'configmaps',
        replicas: 3
      })

      const result = handleScale(apiServer, parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('not scalable')
      }
    })
  })

  describe('scaling deployments', () => {
    it('should scale existing deployment', () => {
      const deployment = createDeployment({
        name: 'nginx-deployment',
        namespace: 'default',
        replicas: 1,
        selector: { matchLabels: { app: 'nginx' } },
        template: {
          metadata: { labels: { app: 'nginx' } },
          spec: { containers: [{ name: 'nginx', image: 'nginx:latest' }] }
        }
      })
      apiServer.createResource('Deployment', deployment)

      const parsed = createParsedCommand({
        name: 'nginx-deployment',
        resource: 'deployments',
        replicas: 5
      })

      const result = handleScale(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe('deployment.apps/nginx-deployment scaled')
      }
    })

    it('should emit DeploymentUpdated event', () => {
      const subscriber = vi.fn()
      eventBus.subscribe('DeploymentUpdated', subscriber)

      const deployment = createDeployment({
        name: 'nginx-deployment',
        namespace: 'default',
        replicas: 1,
        selector: { matchLabels: { app: 'nginx' } },
        template: {
          metadata: { labels: { app: 'nginx' } },
          spec: { containers: [{ name: 'nginx', image: 'nginx:latest' }] }
        }
      })
      apiServer.createResource('Deployment', deployment)

      const parsed = createParsedCommand({
        name: 'nginx-deployment',
        resource: 'deployments',
        replicas: 5
      })

      handleScale(apiServer, parsed)

      expect(subscriber).toHaveBeenCalled()
      const event = subscriber.mock.calls[0][0]
      expect(event.payload.deployment.spec.replicas).toBe(5)
      expect(event.payload.previousDeployment.spec.replicas).toBe(1)
    })

    it('should return error for non-existent deployment', () => {
      const parsed = createParsedCommand({
        name: 'nonexistent',
        resource: 'deployments',
        replicas: 3
      })

      const result = handleScale(apiServer, parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('not found')
      }
    })

    it('should scale deployment in specified namespace', () => {
      apiServer.createResource('Namespace', createNamespace({ name: 'production' }))
      const deployment = createDeployment({
        name: 'nginx-deployment',
        namespace: 'production',
        replicas: 1,
        selector: { matchLabels: { app: 'nginx' } },
        template: {
          metadata: { labels: { app: 'nginx' } },
          spec: { containers: [{ name: 'nginx', image: 'nginx:latest' }] }
        }
      })
      apiServer.createResource('Deployment', deployment)

      const parsed = createParsedCommand({
        name: 'nginx-deployment',
        namespace: 'production',
        resource: 'deployments',
        replicas: 10
      })

      const result = handleScale(apiServer, parsed)

      expect(result.ok).toBe(true)
    })

    it('should not find deployment in wrong namespace', () => {
      apiServer.createResource('Namespace', createNamespace({ name: 'production' }))
      const deployment = createDeployment({
        name: 'nginx-deployment',
        namespace: 'production',
        replicas: 1,
        selector: { matchLabels: { app: 'nginx' } },
        template: {
          metadata: { labels: { app: 'nginx' } },
          spec: { containers: [{ name: 'nginx', image: 'nginx:latest' }] }
        }
      })
      apiServer.createResource('Deployment', deployment)

      const parsed = createParsedCommand({
        name: 'nginx-deployment',
        namespace: 'default',
        resource: 'deployments',
        replicas: 5
      })

      const result = handleScale(apiServer, parsed)

      expect(result.ok).toBe(false)
    })

    it('should allow scaling to zero', () => {
      const deployment = createDeployment({
        name: 'nginx-deployment',
        namespace: 'default',
        replicas: 3,
        selector: { matchLabels: { app: 'nginx' } },
        template: {
          metadata: { labels: { app: 'nginx' } },
          spec: { containers: [{ name: 'nginx', image: 'nginx:latest' }] }
        }
      })
      apiServer.createResource('Deployment', deployment)

      const parsed = createParsedCommand({
        name: 'nginx-deployment',
        resource: 'deployments',
        replicas: 0
      })

      const result = handleScale(apiServer, parsed)

      expect(result.ok).toBe(true)
    })
  })

  describe('scaling replicasets', () => {
    it('should scale existing replicaset', () => {
      const replicaSet = createReplicaSet({
        name: 'nginx-rs',
        namespace: 'default',
        replicas: 2,
        selector: { matchLabels: { app: 'nginx' } },
        template: {
          metadata: { labels: { app: 'nginx' } },
          spec: { containers: [{ name: 'nginx', image: 'nginx:latest' }] }
        }
      })
      apiServer.createResource('ReplicaSet', replicaSet)

      const parsed = createParsedCommand({
        name: 'nginx-rs',
        resource: 'replicasets',
        replicas: 5
      })

      const result = handleScale(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe('replicaset.apps/nginx-rs scaled')
      }
    })

    it('should emit ReplicaSetUpdated event', () => {
      const subscriber = vi.fn()
      eventBus.subscribe('ReplicaSetUpdated', subscriber)

      const replicaSet = createReplicaSet({
        name: 'nginx-rs',
        namespace: 'default',
        replicas: 2,
        selector: { matchLabels: { app: 'nginx' } },
        template: {
          metadata: { labels: { app: 'nginx' } },
          spec: { containers: [{ name: 'nginx', image: 'nginx:latest' }] }
        }
      })
      apiServer.createResource('ReplicaSet', replicaSet)

      const parsed = createParsedCommand({
        name: 'nginx-rs',
        resource: 'replicasets',
        replicas: 8
      })

      handleScale(apiServer, parsed)

      expect(subscriber).toHaveBeenCalled()
      const event = subscriber.mock.calls[0][0]
      expect(event.payload.replicaSet.spec.replicas).toBe(8)
      expect(event.payload.previousReplicaSet.spec.replicas).toBe(2)
    })

    it('should return error for non-existent replicaset', () => {
      const parsed = createParsedCommand({
        name: 'nonexistent',
        resource: 'replicasets',
        replicas: 3
      })

      const result = handleScale(apiServer, parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('not found')
      }
    })
  })

  describe('namespace handling', () => {
    it('should default to default namespace', () => {
      const deployment = createDeployment({
        name: 'nginx-deployment',
        namespace: 'default',
        replicas: 1,
        selector: { matchLabels: { app: 'nginx' } },
        template: {
          metadata: { labels: { app: 'nginx' } },
          spec: { containers: [{ name: 'nginx', image: 'nginx:latest' }] }
        }
      })
      apiServer.createResource('Deployment', deployment)

      const parsed = createParsedCommand({
        name: 'nginx-deployment',
        resource: 'deployments',
        replicas: 3
        // no namespace specified
      })

      const result = handleScale(apiServer, parsed)

      expect(result.ok).toBe(true)
    })
  })
})
