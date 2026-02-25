import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleDelete } from '../../../../../src/core/kubectl/commands/handlers/delete'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { createConfigMap } from '../../../../../src/core/cluster/ressources/ConfigMap'
import { createSecret } from '../../../../../src/core/cluster/ressources/Secret'
import {
  createEventBus,
  type EventBus
} from '../../../../../src/core/cluster/events/EventBus'
import {
  createClusterState,
  type ClusterState
} from '../../../../../src/core/cluster/ClusterState'
import { createDeployment } from '../../../../../src/core/cluster/ressources/Deployment'
import { createService } from '../../../../../src/core/cluster/ressources/Service'
import { createNamespace } from '../../../../../src/core/cluster/ressources/Namespace'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'

describe('kubectl delete handler', () => {
  let eventBus: EventBus
  let clusterState: ClusterState

  beforeEach(() => {
    eventBus = createEventBus()
    clusterState = createClusterState(eventBus)
  })

  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => ({
    action: 'delete',
    resource: 'pods',
    flags: {},
    ...overrides
  })

  describe('validation', () => {
    it('should return error when name is not provided', () => {
      const parsed = createParsedCommand({ name: undefined })

      const result = handleDelete(clusterState, parsed, eventBus)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('must specify the name')
      }
    })
  })

  describe('deleting pods', () => {
    it('should delete existing pod', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      clusterState.addPod(pod)

      const parsed = createParsedCommand({
        name: 'my-pod',
        resource: 'pods'
      })

      const result = handleDelete(clusterState, parsed, eventBus)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('deleted')
        expect(result.value).toContain('my-pod')
      }
    })

    it('should emit PodDeleted event', () => {
      const subscriber = vi.fn()
      eventBus.subscribe('PodDeleted', subscriber)

      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      clusterState.addPod(pod)

      const parsed = createParsedCommand({
        name: 'my-pod',
        resource: 'pods'
      })

      handleDelete(clusterState, parsed, eventBus)

      expect(subscriber).toHaveBeenCalled()
    })

    it('should return error for non-existent pod', () => {
      const parsed = createParsedCommand({
        name: 'nonexistent',
        resource: 'pods'
      })

      const result = handleDelete(clusterState, parsed, eventBus)

      expect(result.ok).toBe(false)
    })

    it('should delete pod in specified namespace', () => {
      clusterState.addNamespace(createNamespace({ name: 'production' }))
      const pod = createPod({
        name: 'my-pod',
        namespace: 'production',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      clusterState.addPod(pod)

      const parsed = createParsedCommand({
        name: 'my-pod',
        namespace: 'production',
        resource: 'pods'
      })

      const result = handleDelete(clusterState, parsed, eventBus)

      expect(result.ok).toBe(true)
    })
  })

  describe('deleting configmaps', () => {
    it('should delete existing configmap', () => {
      const cm = createConfigMap({
        name: 'my-config',
        namespace: 'default',
        data: { key: 'value' }
      })
      clusterState.addConfigMap(cm)

      const parsed = createParsedCommand({
        name: 'my-config',
        resource: 'configmaps'
      })

      const result = handleDelete(clusterState, parsed, eventBus)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('configmap')
        expect(result.value).toContain('deleted')
      }
    })

    it('should emit ConfigMapDeleted event', () => {
      const subscriber = vi.fn()
      eventBus.subscribe('ConfigMapDeleted', subscriber)

      const cm = createConfigMap({
        name: 'my-config',
        namespace: 'default',
        data: {}
      })
      clusterState.addConfigMap(cm)

      const parsed = createParsedCommand({
        name: 'my-config',
        resource: 'configmaps'
      })

      handleDelete(clusterState, parsed, eventBus)

      expect(subscriber).toHaveBeenCalled()
    })

    it('should return error for non-existent configmap', () => {
      const parsed = createParsedCommand({
        name: 'nonexistent',
        resource: 'configmaps'
      })

      const result = handleDelete(clusterState, parsed, eventBus)

      expect(result.ok).toBe(false)
    })
  })

  describe('deleting secrets', () => {
    it('should delete existing secret', () => {
      const secret = createSecret({
        name: 'my-secret',
        namespace: 'default',
        secretType: { type: 'Opaque' },
        data: {}
      })
      clusterState.addSecret(secret)

      const parsed = createParsedCommand({
        name: 'my-secret',
        resource: 'secrets'
      })

      const result = handleDelete(clusterState, parsed, eventBus)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('secret')
        expect(result.value).toContain('deleted')
      }
    })

    it('should emit SecretDeleted event', () => {
      const subscriber = vi.fn()
      eventBus.subscribe('SecretDeleted', subscriber)

      const secret = createSecret({
        name: 'my-secret',
        namespace: 'default',
        secretType: { type: 'Opaque' },
        data: {}
      })
      clusterState.addSecret(secret)

      const parsed = createParsedCommand({
        name: 'my-secret',
        resource: 'secrets'
      })

      handleDelete(clusterState, parsed, eventBus)

      expect(subscriber).toHaveBeenCalled()
    })

    it('should return error for non-existent secret', () => {
      const parsed = createParsedCommand({
        name: 'nonexistent',
        resource: 'secrets'
      })

      const result = handleDelete(clusterState, parsed, eventBus)

      expect(result.ok).toBe(false)
    })
  })

  describe('deleting other resources', () => {
    it('should delete deployment with kind-like message', () => {
      clusterState.addDeployment(
        createDeployment({
          name: 'my-deploy',
          namespace: 'default',
          replicas: 1,
          selector: { matchLabels: { app: 'my-deploy' } },
          template: {
            metadata: { labels: { app: 'my-deploy' } },
            spec: {
              containers: [{ name: 'my-deploy', image: 'nginx:latest' }]
            }
          }
        })
      )

      const parsed = createParsedCommand({
        name: 'my-deploy',
        resource: 'deployments'
      })

      const result = handleDelete(clusterState, parsed, eventBus)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('deployment.apps')
        expect(result.value).toContain('deleted from default namespace')
      }
    })

    it('should return not found for missing deployment', () => {
      const parsed = createParsedCommand({
        name: 'missing-deploy',
        resource: 'deployments'
      })

      const result = handleDelete(clusterState, parsed, eventBus)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('deployments.apps "missing-deploy" not found')
      }
    })

    it('should delete service with namespace suffix', () => {
      clusterState.addService(
        createService({
          name: 'my-service',
          namespace: 'default',
          selector: { app: 'my-app' },
          ports: [{ port: 80 }]
        })
      )

      const parsed = createParsedCommand({
        name: 'my-service',
        resource: 'services'
      })

      const result = handleDelete(clusterState, parsed, eventBus)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain(
          'service "my-service" deleted from default namespace'
        )
      }
    })

    it('should handle namespace delete (simulated)', () => {
      clusterState.addNamespace(createNamespace({ name: 'my-namespace' }))
      const parsed = createParsedCommand({
        name: 'my-namespace',
        resource: 'namespaces'
      })

      const result = handleDelete(clusterState, parsed, eventBus)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('namespace')
      }
    })

    it('should cascade delete namespaced resources when deleting namespace', () => {
      clusterState.addNamespace(createNamespace({ name: 'project-x' }))
      clusterState.addPod(
        createPod({
          name: 'app-pod',
          namespace: 'project-x',
          containers: [{ name: 'main', image: 'nginx:latest' }]
        })
      )
      clusterState.addConfigMap(
        createConfigMap({
          name: 'app-config',
          namespace: 'project-x',
          data: { key: 'value' }
        })
      )
      clusterState.addService(
        createService({
          name: 'app-service',
          namespace: 'project-x',
          selector: { app: 'app' },
          ports: [{ port: 80 }]
        })
      )

      const parsed = createParsedCommand({
        name: 'project-x',
        resource: 'namespaces'
      })

      const result = handleDelete(clusterState, parsed, eventBus)

      expect(result.ok).toBe(true)
      expect(clusterState.findNamespace('project-x').ok).toBe(false)
      expect(clusterState.getPods('project-x')).toHaveLength(0)
      expect(clusterState.getConfigMaps('project-x')).toHaveLength(0)
      expect(clusterState.getServices('project-x')).toHaveLength(0)
    })

    it('should handle unknown resource type', () => {
      const parsed = createParsedCommand({
        name: 'my-resource',
        resource: 'unknown' as any
      })

      const result = handleDelete(clusterState, parsed, eventBus)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('deleted')
      }
    })
  })

  describe('namespace handling', () => {
    it('should default to default namespace', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      clusterState.addPod(pod)

      const parsed = createParsedCommand({
        name: 'my-pod',
        resource: 'pods'
        // no namespace specified
      })

      const result = handleDelete(clusterState, parsed, eventBus)

      expect(result.ok).toBe(true)
    })

    it('should not find pod in wrong namespace', () => {
      clusterState.addNamespace(createNamespace({ name: 'production' }))
      const pod = createPod({
        name: 'my-pod',
        namespace: 'production',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      clusterState.addPod(pod)

      const parsed = createParsedCommand({
        name: 'my-pod',
        namespace: 'default',
        resource: 'pods'
      })

      const result = handleDelete(clusterState, parsed, eventBus)

      expect(result.ok).toBe(false)
    })
  })
})
