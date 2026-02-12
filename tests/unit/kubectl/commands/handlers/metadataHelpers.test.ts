import { beforeEach, describe, expect, it, vi } from 'vitest'
import { handleMetadataChange } from '../../../../../src/core/kubectl/commands/handlers/metadataHelpers'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { createConfigMap } from '../../../../../src/core/cluster/ressources/ConfigMap'
import { createSecret } from '../../../../../src/core/cluster/ressources/Secret'
import {
  createEventBus,
  type EventBus
} from '../../../../../src/core/cluster/events/EventBus'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'
import { createClusterStateData } from '../../../helpers/utils'

describe('metadataHelpers', () => {
  let eventBus: EventBus

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
    eventBus = createEventBus()
  })

  const createState = (
    pods: ReturnType<typeof createPod>[] = [],
    configMaps: ReturnType<typeof createConfigMap>[] = [],
    secrets: ReturnType<typeof createSecret>[] = []
  ) => createClusterStateData({ pods, configMaps, secrets })

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

      const result = handleMetadataChange(state, parsed, labelConfig, eventBus)

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

      const result = handleMetadataChange(state, parsed, labelConfig, eventBus)

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

      const result = handleMetadataChange(state, parsed, labelConfig, eventBus)

      expect(result.ok).toBe(false)
    })

    it('should return error for unsupported resource type', () => {
      const state = createState()
      const parsed = createParsedCommand({
        name: 'my-deploy',
        resource: 'deployments',
        labelChanges: { app: 'test' }
      })

      const result = handleMetadataChange(state, parsed, labelConfig, eventBus)

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

      const result = handleMetadataChange(state, parsed, labelConfig, eventBus)

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

      const result = handleMetadataChange(state, parsed, labelConfig, eventBus)

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

      const result = handleMetadataChange(state, parsed, labelConfig, eventBus)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('already exists')
        expect(result.error).toContain('--overwrite')
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

      const result = handleMetadataChange(state, parsed, labelConfig, eventBus)

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

      const result = handleMetadataChange(state, parsed, labelConfig, eventBus)

      expect(result.ok).toBe(true)
    })

    it('should emit PodLabeled event', () => {
      const subscriber = vi.fn()
      eventBus.subscribe('PodLabeled', subscriber)

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

      handleMetadataChange(state, parsed, labelConfig, eventBus)

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

      const result = handleMetadataChange(
        state,
        parsed,
        annotateConfig,
        eventBus
      )

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('annotated')
      }
    })

    it('should emit PodAnnotated event', () => {
      const subscriber = vi.fn()
      eventBus.subscribe('PodAnnotated', subscriber)

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

      handleMetadataChange(state, parsed, annotateConfig, eventBus)

      expect(subscriber).toHaveBeenCalled()
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

      const result = handleMetadataChange(state, parsed, labelConfig, eventBus)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('configmap')
        expect(result.value).toContain('labeled')
      }
    })

    it('should emit ConfigMapLabeled event', () => {
      const subscriber = vi.fn()
      eventBus.subscribe('ConfigMapLabeled', subscriber)

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

      handleMetadataChange(state, parsed, labelConfig, eventBus)

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

      const result = handleMetadataChange(state, parsed, labelConfig, eventBus)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('secret')
        expect(result.value).toContain('labeled')
      }
    })

    it('should emit SecretLabeled event', () => {
      const subscriber = vi.fn()
      eventBus.subscribe('SecretLabeled', subscriber)

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

      handleMetadataChange(state, parsed, labelConfig, eventBus)

      expect(subscriber).toHaveBeenCalled()
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

      const result = handleMetadataChange(state, parsed, labelConfig, eventBus)

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

      const result = handleMetadataChange(state, parsed, labelConfig, eventBus)

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

      const result = handleMetadataChange(state, parsed, labelConfig, eventBus)

      expect(result.ok).toBe(false)
    })
  })
})
