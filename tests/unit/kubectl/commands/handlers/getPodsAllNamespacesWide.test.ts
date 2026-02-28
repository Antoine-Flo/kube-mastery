import { describe, expect, it } from 'vitest'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { handleGet } from '../../../../../src/core/kubectl/commands/handlers/get'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'
import { createClusterStateData } from '../../../helpers/utils'

const createParsedCommand = (
  overrides: Partial<ParsedCommand> = {}
): ParsedCommand => {
  return {
    action: 'get',
    resource: 'pods',
    flags: {},
    ...overrides
  }
}

const splitTableLine = (line: string): string[] => {
  return line.trim().split(/\s{2,}/)
}

describe('kubectl get pods -A wide output', () => {
  it('filters kube-system pods by tier=control-plane label selector', () => {
    const pods = [
      createPod({
        name: 'kube-apiserver-conformance-control-plane',
        namespace: 'kube-system',
        labels: { tier: 'control-plane', component: 'kube-apiserver' },
        nodeName: 'conformance-control-plane',
        containers: [{ name: 'kube-apiserver', image: 'registry.k8s.io/kube-apiserver:v1.35.0' }],
        phase: 'Running'
      }),
      createPod({
        name: 'coredns-abcd',
        namespace: 'kube-system',
        labels: { 'k8s-app': 'kube-dns' },
        nodeName: 'conformance-control-plane',
        containers: [{ name: 'coredns', image: 'registry.k8s.io/coredns/coredns:v1.13.1' }],
        phase: 'Running'
      }),
      createPod({
        name: 'web-default',
        namespace: 'default',
        labels: { app: 'web' },
        nodeName: 'conformance-worker',
        containers: [{ name: 'nginx', image: 'nginx:1.25' }],
        phase: 'Running'
      })
    ]
    const state = createClusterStateData({ pods })
    const parsed = createParsedCommand({
      namespace: 'kube-system',
      selector: { tier: 'control-plane' }
    })

    const result = handleGet(state, parsed)

    expect(result).toContain('kube-apiserver-conformance-control-plane')
    expect(result).not.toContain('coredns-abcd')
    expect(result).not.toContain('web-default')
  })

  it('includes NAMESPACE as first column in wide output', () => {
    const pods = [
      createPod({
        name: 'web-a',
        namespace: 'default',
        nodeName: 'sim-worker',
        containers: [{ name: 'nginx', image: 'nginx:1.25' }],
        phase: 'Running'
      }),
      createPod({
        name: 'dns-a',
        namespace: 'kube-system',
        nodeName: 'sim-control-plane',
        containers: [{ name: 'coredns', image: 'registry.k8s.io/coredns/coredns:v1.13.1' }],
        phase: 'Running'
      })
    ]
    const state = createClusterStateData({ pods })
    const parsed = createParsedCommand({
      flags: { output: 'wide', 'all-namespaces': true }
    })

    const result = handleGet(state, parsed)
    const [header] = result.split('\n')

    expect(header).toContain('NAMESPACE')
    const columns = splitTableLine(header)
    expect(columns[0]).toBe('NAMESPACE')
  })

  it('prints rows with namespace as first field in wide output', () => {
    const pods = [
      createPod({
        name: 'web',
        namespace: 'default',
        nodeName: 'sim-worker',
        containers: [{ name: 'nginx', image: 'nginx:1.25' }],
        phase: 'Running'
      }),
      createPod({
        name: 'dns',
        namespace: 'kube-system',
        nodeName: 'sim-control-plane',
        containers: [{ name: 'coredns', image: 'registry.k8s.io/coredns/coredns:v1.13.1' }],
        phase: 'Running'
      })
    ]
    const state = createClusterStateData({ pods })
    const parsed = createParsedCommand({
      flags: { output: 'wide', A: true }
    })

    const result = handleGet(state, parsed)
    const lines = result.split('\n').filter((line) => line.trim().length > 0)
    const row1 = splitTableLine(lines[1])
    const row2 = splitTableLine(lines[2])

    expect(['default', 'kube-system']).toContain(row1[0])
    expect(['default', 'kube-system']).toContain(row2[0])
  })

  it('should not generate duplicate pod IPs for different pods', () => {
    const pods = [
      createPod({
        name: 'coredns-22h9q09vnb-oqbh3',
        namespace: 'kube-system',
        nodeName: 'sim-worker2',
        containers: [{ name: 'coredns', image: 'registry.k8s.io/coredns/coredns:v1.13.1' }],
        phase: 'Running'
      }),
      createPod({
        name: 'local-path-provisioner-s78p0y92xz-augpu',
        namespace: 'local-path-storage',
        nodeName: 'sim-control-plane',
        containers: [
          {
            name: 'local-path-provisioner',
            image: 'docker.io/kindest/local-path-provisioner:v20251212-v0.29.0-alpha-105-g20ccfc88'
          }
        ],
        phase: 'Running'
      })
    ]
    const state = createClusterStateData({ pods })
    const parsed = createParsedCommand({
      flags: { output: 'wide', 'all-namespaces': true }
    })

    const result = handleGet(state, parsed)
    const lines = result.split('\n').filter((line) => line.trim().length > 0)
    const rows = lines.slice(1).map(splitTableLine)
    const ipColumnIndex = 6
    const ips = rows.map((row) => row[ipColumnIndex])

    expect(new Set(ips).size).toBe(ips.length)
  })
})
