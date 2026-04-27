import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createNode } from '../../../../../src/core/cluster/ressources/Node'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { createMetricsProvider } from '../../../../../src/core/metrics/metricsProvider'
import { handleTop } from '../../../../../src/core/kubectl/commands/handlers/top'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'

const createTopParsedCommand = (
  action: 'top-pods' | 'top-nodes',
  overrides: Partial<ParsedCommand> = {}
): ParsedCommand => {
  return {
    action,
    flags: {},
    output: 'table',
    ...overrides
  }
}

describe('kubectl top handler', () => {
  it('renders top pods output for a namespace', () => {
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'web-1',
        namespace: 'default',
        nodeName: 'sim-worker',
        phase: 'Running',
        containers: [
          {
            name: 'web',
            image: 'nginx:1.28',
            resources: {
              requests: {
                cpu: '100m',
                memory: '128Mi'
              }
            }
          }
        ]
      })
    )
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'dns-1',
        namespace: 'kube-system',
        nodeName: 'sim-worker',
        phase: 'Running',
        labels: {
          app: 'dns'
        },
        containers: [
          {
            name: 'dns',
            image: 'coredns:1.11',
            resources: {
              requests: {
                cpu: '50m',
                memory: '70Mi'
              }
            }
          }
        ]
      })
    )

    const result = handleTop(
      apiServer,
      createMetricsProvider(apiServer),
      createTopParsedCommand('top-pods', {
        namespace: 'default'
      })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('NAME')
    expect(result.value).toContain('CPU')
    expect(result.value).toContain('MEMORY')
    expect(result.value).toContain('web-1')
    expect(result.value).not.toContain('dns-1')
  })

  it('renders top pods across namespaces with selector', () => {
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'dns-a',
        namespace: 'kube-system',
        nodeName: 'sim-worker',
        phase: 'Running',
        labels: {
          app: 'dns'
        },
        containers: [{ name: 'dns', image: 'coredns:1.11' }]
      })
    )
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'worker-a',
        namespace: 'default',
        nodeName: 'sim-worker',
        phase: 'Running',
        labels: {
          app: 'worker'
        },
        containers: [{ name: 'worker', image: 'busybox:1.36' }]
      })
    )

    const result = handleTop(
      apiServer,
      createMetricsProvider(apiServer),
      createTopParsedCommand('top-pods', {
        flags: { 'all-namespaces': true },
        selector: {
          requirements: [
            {
              key: 'app',
              operator: 'Equals',
              values: ['dns']
            }
          ]
        }
      })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('NAMESPACE')
    expect(result.value).toContain('dns-a')
    expect(result.value).toContain('kube-system')
    expect(result.value).not.toContain('worker-a')
  })

  it('renders top nodes output with percentages', () => {
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Node',
      createNode({
        name: 'sim-worker',
        status: {
          nodeInfo: {
            architecture: 'amd64',
            containerRuntimeVersion: 'containerd://2.2.0',
            kernelVersion: '6.6.87.2',
            kubeletVersion: 'v1.35.0',
            operatingSystem: 'linux',
            osImage: 'Debian GNU/Linux 12'
          },
          allocatable: {
            cpu: '4000m',
            memory: '8Gi'
          }
        }
      })
    )
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'cpu-burner',
        namespace: 'default',
        nodeName: 'sim-worker',
        phase: 'Running',
        containers: [
          {
            name: 'main',
            image: 'busybox:1.36',
            resources: {
              requests: {
                cpu: '300m',
                memory: '256Mi'
              }
            }
          }
        ]
      })
    )

    const result = handleTop(
      apiServer,
      createMetricsProvider(apiServer),
      createTopParsedCommand('top-nodes')
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('sim-worker')
    expect(result.value).toContain('CPU(%)')
    expect(result.value).toContain('MEMORY(%)')
    expect(result.value).toContain('%')
  })

  it('returns no resources found message when top pods has no matches', () => {
    const apiServer = createApiServerFacade()
    const result = handleTop(
      apiServer,
      createMetricsProvider(apiServer),
      createTopParsedCommand('top-pods', {
        namespace: 'default'
      })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('No resources found in default namespace.')
  })

  it('returns no resources found for top pods all-namespaces without matches', () => {
    const apiServer = createApiServerFacade()
    const result = handleTop(
      apiServer,
      createMetricsProvider(apiServer),
      createTopParsedCommand('top-pods', {
        flags: { A: true }
      })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toBe('No resources found')
  })

  it('hides headers for top pods with --no-headers', () => {
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'web-no-header',
        namespace: 'default',
        nodeName: 'sim-worker',
        phase: 'Running',
        containers: [{ name: 'web', image: 'nginx:1.28' }]
      })
    )

    const result = handleTop(
      apiServer,
      createMetricsProvider(apiServer),
      createTopParsedCommand('top-pods', {
        namespace: 'default',
        flags: { 'no-headers': true }
      })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('web-no-header')
    expect(result.value).not.toContain('NAME')
    expect(result.value).not.toContain('CPU(cores)')
    expect(result.value).not.toContain('MEMORY(bytes)')
  })

  it('hides headers for top nodes with --no-headers', () => {
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Node',
      createNode({
        name: 'node-no-header',
        status: {
          nodeInfo: {
            architecture: 'amd64',
            containerRuntimeVersion: 'containerd://2.2.0',
            kernelVersion: '6.6.87.2',
            kubeletVersion: 'v1.35.0',
            operatingSystem: 'linux',
            osImage: 'Debian GNU/Linux 12'
          },
          allocatable: {
            cpu: '1000m',
            memory: '2Gi'
          }
        }
      })
    )

    const result = handleTop(
      apiServer,
      createMetricsProvider(apiServer),
      createTopParsedCommand('top-nodes', {
        flags: { 'no-headers': true }
      })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('node-no-header')
    expect(result.value).not.toContain('NAME')
    expect(result.value).not.toContain('CPU(%)')
    expect(result.value).not.toContain('MEMORY(%)')
  })

  it('renders zero allocatable percentages as 0%', () => {
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Node',
      createNode({
        name: 'zero-node',
        status: {
          nodeInfo: {
            architecture: 'amd64',
            containerRuntimeVersion: 'containerd://2.2.0',
            kernelVersion: '6.6.87.2',
            kubeletVersion: 'v1.35.0',
            operatingSystem: 'linux',
            osImage: 'Debian GNU/Linux 12'
          },
          allocatable: {
            cpu: 'invalid',
            memory: 'invalid'
          }
        }
      })
    )

    const result = handleTop(
      apiServer,
      createMetricsProvider(apiServer),
      createTopParsedCommand('top-nodes')
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('0%')
  })

  it('returns invalid top action error for unsupported action', () => {
    const apiServer = createApiServerFacade()
    const result = handleTop(apiServer, createMetricsProvider(apiServer), {
      action: 'get' as ParsedCommand['action'],
      flags: {}
    } as ParsedCommand)

    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error).toContain('invalid top action')
  })
})
