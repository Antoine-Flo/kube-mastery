import { describe, expect, it } from 'vitest'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'
import { createSimPodIpAllocator } from '../../../../src/core/cluster/ipAllocator/SimPodIpAllocator'

describe('SimPodIpAllocator', () => {
  it('assigns unique IPs for different pods', () => {
    const allocator = createSimPodIpAllocator()
    const podA = createPod({
      name: 'coredns-22h9q09vnb-oqbh3',
      namespace: 'kube-system',
      containers: [{ name: 'coredns', image: 'registry.k8s.io/coredns/coredns:v1.13.1' }],
      phase: 'Running'
    })
    const podB = createPod({
      name: 'local-path-provisioner-s78p0y92xz-augpu',
      namespace: 'local-path-storage',
      containers: [
        {
          name: 'local-path-provisioner',
          image: 'docker.io/kindest/local-path-provisioner:v20251212-v0.29.0-alpha-105-g20ccfc88'
        }
      ],
      phase: 'Running'
    })

    const ipA = allocator.assign(podA)
    const ipB = allocator.assign(podB)

    expect(ipA).not.toBe(ipB)
  })

  it('returns stable IP for same pod key', () => {
    const allocator = createSimPodIpAllocator()
    const pod = createPod({
      name: 'web',
      namespace: 'default',
      containers: [{ name: 'nginx', image: 'nginx:1.25' }],
      phase: 'Running'
    })

    const first = allocator.assign(pod)
    const second = allocator.assign(pod)

    expect(second).toBe(first)
  })

  it('releases and re-assigns IP after pod deletion', () => {
    const allocator = createSimPodIpAllocator()
    const pod = createPod({
      name: 'api',
      namespace: 'default',
      containers: [{ name: 'nginx', image: 'nginx:1.25' }],
      phase: 'Running'
    })

    const first = allocator.assign(pod)
    allocator.release(pod)
    const second = allocator.assign(pod)

    expect(second).toBe(first)
  })
})
