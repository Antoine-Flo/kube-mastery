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
})
