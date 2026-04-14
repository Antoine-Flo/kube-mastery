import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleMetadataChange } from '../../../../../src/core/kubectl/commands/metadataHelpers'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { createConfigMap } from '../../../../../src/core/cluster/ressources/ConfigMap'
import { createSecret } from '../../../../../src/core/cluster/ressources/Secret'
import { createDeployment } from '../../../../../src/core/cluster/ressources/Deployment'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'
import { createClusterStateData } from '../../../helpers/utils'

describe('metadataHelpers', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>

  const labelConfig = {
    metadataType: 'labels' as const,
    commandName: 'label' as const,
    changesKey: 'labelChanges' as const,
    actionPastTense: 'labeled' as const
  }

  const annotateConfig = {
    metadataType: 'annotations' as const,
    commandName: 'annotate' as const,
    changesKey: 'annotationChanges' as const,
    actionPastTense: 'annotated' as const
  }

  beforeEach(() => {
    apiServer = createApiServerFacade()
  })

  const createState = (
    pods: ReturnType<typeof createPod>[] = [],
    configMaps: ReturnType<typeof createConfigMap>[] = [],
    secrets: ReturnType<typeof createSecret>[] = [],
    deployments: ReturnType<typeof createDeployment>[] = []
  ) => createClusterStateData({ pods, configMaps, secrets, deployments })

  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => ({
    action: 'label',
    resource: 'pods',
    flags: {},
    ...overrides
  })

  describe('validation', () => {
    it('should return error when resource name is not provided', () => {
      const state = createState()
      const parsed = createParsedCommand({
        name: undefined,
        labelChanges: { app: 'test' }
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, labelConfig)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('must specify the name')
      }
    })

    it('should return error when no label changes provided', () => {
      const state = createState()
      const parsed = createParsedCommand({
        name: 'my-pod',
        labelChanges: undefined
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, labelConfig)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('No label changes')
      }
    })

    it('should return error when label changes is empty object', () => {
      const state = createState()
      const parsed = createParsedCommand({
        name: 'my-pod',
        labelChanges: {}
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, labelConfig)

      expect(result.ok).toBe(false)
    })

    it('should return error for unsupported resource type', () => {
      const state = createState()
      const parsed = createParsedCommand({
        name: 'my-ingress-class',
        resource: 'ingressclasses',
        labelChanges: { app: 'test' }
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, labelConfig)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('not supported')
      }
    })

    it('should return error when resource not found', () => {
      const state = createState()
      const parsed = createParsedCommand({
        name: 'nonexistent',
        labelChanges: { app: 'test' }
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, labelConfig)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('NotFound')
      }
    })
  })

  describe('labeling pods', () => {
    it('should add label to pod', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        labelChanges: { app: 'web' }
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, labelConfig)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('labeled')
      }
    })

    it('should return error when overwriting without --overwrite flag', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        labels: { app: 'old-value' }
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        labelChanges: { app: 'new-value' }
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, labelConfig)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe(
          "'app' already has a value (old-value), and --overwrite is false"
        )
      }
    })

    it('should allow overwrite with --overwrite flag', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        labels: { app: 'old-value' }
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        labelChanges: { app: 'new-value' },
        flags: { overwrite: true }
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, labelConfig)

      expect(result.ok).toBe(true)
    })

    it('should allow overwrite with --overwrite=true flag value', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        labels: { app: 'old-value' }
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        labelChanges: { app: 'new-value' },
        flags: { overwrite: 'true' }
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, labelConfig)

      expect(result.ok).toBe(true)
    })

    it('should remove label with null value', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        labels: { app: 'web', env: 'prod' }
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        labelChanges: { app: null }
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, labelConfig)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('unlabeled')
      }
    })

    it('should emit PodLabeled event', () => {
      const subscriber = vi.fn()
      apiServer.eventBus.subscribe('PodLabeled', subscriber)

      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        labelChanges: { app: 'web' }
      })

      apiServer.etcd.restore(state)
      handleMetadataChange(apiServer, parsed, labelConfig)

      expect(subscriber).toHaveBeenCalled()
    })

    it('should emit PodUpdated event for pod label changes', () => {
      const subscriber = vi.fn()
      apiServer.eventBus.subscribe('PodUpdated', subscriber)

      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        labels: { app: 'web' },
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        labelChanges: { app: null }
      })

      apiServer.etcd.restore(state)
      handleMetadataChange(apiServer, parsed, labelConfig)

      expect(subscriber).toHaveBeenCalled()
    })
  })

  describe('annotating pods', () => {
    it('should add annotation to pod', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        action: 'annotate',
        name: 'my-pod',
        annotationChanges: { description: 'My app' }
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, annotateConfig)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('annotated')
      }
    })

    it('should emit PodAnnotated event', () => {
      const subscriber = vi.fn()
      apiServer.eventBus.subscribe('PodAnnotated', subscriber)

      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        action: 'annotate',
        name: 'my-pod',
        annotationChanges: { note: 'important' }
      })

      apiServer.etcd.restore(state)
      handleMetadataChange(apiServer, parsed, annotateConfig)

      expect(subscriber).toHaveBeenCalled()
    })

    it('should return error when overwriting annotation without --overwrite flag', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        annotations: { contact: 'platform-team@example.com' }
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        action: 'annotate',
        name: 'my-pod',
        annotationChanges: { contact: 'new-team@example.com' }
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, annotateConfig)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe(
          "'contact' already has a value (platform-team@example.com), and --overwrite is false"
        )
      }
    })

    it('should overwrite annotation value with --overwrite flag', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        annotations: { contact: 'platform-team@example.com' }
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        action: 'annotate',
        name: 'my-pod',
        annotationChanges: { contact: 'new-team@example.com' },
        flags: { overwrite: true }
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, annotateConfig)

      expect(result.ok).toBe(true)
      const updatedPod = apiServer.findResource('Pod', 'my-pod', 'default')
      expect(updatedPod.ok).toBe(true)
      if (updatedPod.ok) {
        expect(updatedPod.value.metadata.annotations?.contact).toBe(
          'new-team@example.com'
        )
      }
    })

    it('should remove annotation with null value', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        annotations: {
          contact: 'platform-team@example.com',
          runbook: 'https://wiki.example.com/runbooks/web'
        }
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        action: 'annotate',
        name: 'my-pod',
        annotationChanges: { contact: null }
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, annotateConfig)

      expect(result.ok).toBe(true)
      const updatedPod = apiServer.findResource('Pod', 'my-pod', 'default')
      expect(updatedPod.ok).toBe(true)
      if (updatedPod.ok) {
        expect(updatedPod.value.metadata.annotations).toEqual({
          runbook: 'https://wiki.example.com/runbooks/web'
        })
      }
    })
  })

  describe('labeling configmaps', () => {
    it('should add label to configmap', () => {
      const cm = createConfigMap({
        name: 'my-config',
        namespace: 'default',
        data: { key: 'value' }
      })
      const state = createState([], [cm])
      const parsed = createParsedCommand({
        name: 'my-config',
        resource: 'configmaps',
        labelChanges: { env: 'prod' }
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, labelConfig)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('configmap')
        expect(result.value).toContain('labeled')
      }
    })

    it('should emit ConfigMapLabeled event', () => {
      const subscriber = vi.fn()
      apiServer.eventBus.subscribe('ConfigMapLabeled', subscriber)

      const cm = createConfigMap({
        name: 'my-config',
        namespace: 'default',
        data: {}
      })
      const state = createState([], [cm])
      const parsed = createParsedCommand({
        name: 'my-config',
        resource: 'configmaps',
        labelChanges: { app: 'test' }
      })

      apiServer.etcd.restore(state)
      handleMetadataChange(apiServer, parsed, labelConfig)

      expect(subscriber).toHaveBeenCalled()
    })
  })

  describe('labeling secrets', () => {
    it('should add label to secret', () => {
      const secret = createSecret({
        name: 'my-secret',
        namespace: 'default',
        secretType: { type: 'Opaque' },
        data: {}
      })
      const state = createState([], [], [secret])
      const parsed = createParsedCommand({
        name: 'my-secret',
        resource: 'secrets',
        labelChanges: { type: 'credentials' }
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, labelConfig)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('secret')
        expect(result.value).toContain('labeled')
      }
    })

    it('should emit SecretLabeled event', () => {
      const subscriber = vi.fn()
      apiServer.eventBus.subscribe('SecretLabeled', subscriber)

      const secret = createSecret({
        name: 'my-secret',
        namespace: 'default',
        secretType: { type: 'Opaque' },
        data: {}
      })
      const state = createState([], [], [secret])
      const parsed = createParsedCommand({
        name: 'my-secret',
        resource: 'secrets',
        labelChanges: { app: 'test' }
      })

      apiServer.etcd.restore(state)
      handleMetadataChange(apiServer, parsed, labelConfig)

      expect(subscriber).toHaveBeenCalled()
    })
  })

  describe('labeling deployments', () => {
    it('should add label to deployment', () => {
      const deployment = createDeployment({
        name: 'my-deployment',
        namespace: 'default',
        selector: { matchLabels: { app: 'demo' } },
        template: {
          metadata: { labels: { app: 'demo' } },
          spec: {
            containers: [{ name: 'nginx', image: 'nginx:latest' }]
          }
        }
      })
      const state = createState([], [], [], [deployment])
      const parsed = createParsedCommand({
        name: 'my-deployment',
        resource: 'deployments',
        labelChanges: { tier: 'experiment' }
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, labelConfig)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('deployment')
        expect(result.value).toContain('labeled')
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
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        labelChanges: { app: 'test' }
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, labelConfig)

      expect(result.ok).toBe(true)
    })

    it('should find resource in specified namespace', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'production',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        namespace: 'production',
        labelChanges: { app: 'test' }
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, labelConfig)

      expect(result.ok).toBe(true)
    })

    it('should not find resource in wrong namespace', () => {
      const pod = createPod({
        name: 'my-pod',
        namespace: 'production',
        containers: [{ name: 'main', image: 'nginx:latest' }]
      })
      const state = createState([pod])
      const parsed = createParsedCommand({
        name: 'my-pod',
        namespace: 'default',
        labelChanges: { app: 'test' }
      })

      apiServer.etcd.restore(state)
      const result = handleMetadataChange(apiServer, parsed, labelConfig)

      expect(result.ok).toBe(false)
    })
  })
})
