import { describe, expect, it } from 'vitest'
import { createImageRegistry } from '../../../src/core/containers/registry/ImageRegistry'

describe('system image registry coverage', () => {
  it('validates all bootstrap system images used by runtime workloads', () => {
    const registry = createImageRegistry()
    const systemImages = [
      'k8s.gcr.io/pause:3.9',
      'registry.k8s.io/etcd:3.5.21-0',
      'registry.k8s.io/kube-apiserver:v1.35.0',
      'registry.k8s.io/kube-controller-manager:v1.35.0',
      'registry.k8s.io/kube-scheduler:v1.35.0'
    ]

    for (const image of systemImages) {
      const validation = registry.validateImage(image)
      expect(validation.ok).toBe(true)
    }
  })

  it('returns startup logs for images that define them', () => {
    const registry = createImageRegistry()
    const logsResult = registry.getStartupLogs('redis:7.0')

    expect(logsResult.ok).toBe(true)
    if (!logsResult.ok) {
      return
    }

    expect(logsResult.value.length).toBeGreaterThan(0)
    expect(logsResult.value[0]).toContain('Warning: no config file specified')
  })

  it('returns empty startup logs for images without startup profile', () => {
    const registry = createImageRegistry()
    const logsResult = registry.getStartupLogs('k8s.gcr.io/pause:3.9')

    expect(logsResult.ok).toBe(true)
    if (!logsResult.ok) {
      return
    }

    expect(logsResult.value).toEqual([])
  })
})
