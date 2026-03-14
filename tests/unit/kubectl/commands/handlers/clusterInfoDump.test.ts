import { beforeEach, describe, expect, it } from 'vitest'
import { handleClusterInfo } from '../../../../../src/core/kubectl/commands/handlers/clusterInfo'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { createNamespace } from '../../../../../src/core/cluster/ressources/Namespace'
import { createConfigMap } from '../../../../../src/core/cluster/ressources/ConfigMap'
import { createSecret } from '../../../../../src/core/cluster/ressources/Secret'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'
import type { ClusterStateData } from '../../../../../src/core/cluster/ClusterState'
import { createClusterStateData } from '../../../helpers/utils'

describe('kubectl cluster-info handler (with dump subcommand)', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>
  let stateData: ClusterStateData

  beforeEach(() => {
    apiServer = createApiServerFacade()

    // Add some test resources
    const pod = createPod({
      name: 'test-pod',
      namespace: 'default',
      containers: [{ name: 'nginx', image: 'nginx:latest' }],
      phase: 'Running',
      logs: ['Log line 1', 'Log line 2']
    })
    apiServer.createResource('Pod', pod)

    const configMap = createConfigMap({
      name: 'test-cm',
      namespace: 'default',
      data: { key1: 'value1' }
    })
    apiServer.createResource('ConfigMap', configMap)

    const secret = createSecret({
      name: 'test-secret',
      namespace: 'default',
      secretType: { type: 'Opaque' },
      data: { password: Buffer.from('secret123').toString('base64') }
    })
    apiServer.createResource('Secret', secret)

    stateData = apiServer.snapshotState()
  })

  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => ({
    action: 'cluster-info',
    flags: {},
    ...overrides
  })

  describe('dump subcommand', () => {
    it('should dump cluster information with default namespaces', () => {
      const parsed = createParsedCommand({
        flags: { dump: true }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(stateData)
      const result = handleClusterInfo(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        // Default format is JSON
        expect(result.value).toContain('"kind": "NodeList"')
        expect(result.value).toContain('"kind": "EventList"')
        expect(result.value).toContain('"kind": "PodList"')
        expect(result.value).toContain('"kind": "ConfigMapList"')
        expect(result.value).toContain('"kind": "SecretList"')
        expect(result.value).toContain('"name": "test-pod"')
        expect(result.value).toContain('"name": "test-cm"')
        expect(result.value).toContain('"name": "test-secret"')
      }
    })

    it('should include pod logs in dump', () => {
      const parsed = createParsedCommand({
        flags: { dump: true }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(stateData)
      const result = handleClusterInfo(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        // Logs are plain text after JSON resources
        expect(result.value).toContain(
          '==== START logs for pod default/test-pod ===='
        )
        expect(result.value).toContain('Log line 1')
        expect(result.value).toContain('Log line 2')
        expect(result.value).toContain(
          '==== END logs for pod default/test-pod ===='
        )
      }
    })
  })

  describe('default cluster-info command', () => {
    it('should read control plane URL from kube-public/cluster-info ConfigMap', () => {
      const stateWithClusterInfo = createClusterStateData({
        configMaps: [
          createConfigMap({
            name: 'cluster-info',
            namespace: 'kube-public',
            data: {
              kubeconfig: [
                'apiVersion: v1',
                'kind: Config',
                'clusters:',
                '- cluster:',
                '    server: https://10.0.0.1:6443',
                '  name: kubernetes'
              ].join('\n')
            }
          })
        ]
      })

      const parsed = createParsedCommand()
      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(stateWithClusterInfo)
      const result = handleClusterInfo(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain(
          'Kubernetes control plane is running at https://10.0.0.1:6443'
        )
        expect(result.value).toContain(
          'CoreDNS is running at https://10.0.0.1:6443/api/v1/namespaces/kube-system/services/kube-dns:dns/proxy'
        )
      }
    })

    it('should return explicit error when cluster-info ConfigMap is missing', () => {
      const parsed = createParsedCommand()
      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(stateData)
      const result = handleClusterInfo(apiServer, parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain(
          'cluster-info ConfigMap is missing in kube-public namespace'
        )
      }
    })

    it('should return explicit error when cluster-info kubeconfig is invalid', () => {
      const stateWithInvalidClusterInfo = createClusterStateData({
        configMaps: [
          createConfigMap({
            name: 'cluster-info',
            namespace: 'kube-public',
            data: {
              kubeconfig: 'apiVersion: v1\nkind: Config\nclusters: []'
            }
          })
        ]
      })

      const parsed = createParsedCommand()
      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(stateWithInvalidClusterInfo)
      const result = handleClusterInfo(apiServer, parsed)

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain(
          'cluster-info ConfigMap in kube-public is invalid: missing kubeconfig server URL'
        )
      }
    })
  })

  describe('--all-namespaces flag', () => {
    it('should dump all namespaces when --all-namespaces is set', () => {
      // Add resources in different namespace
      const multiNsApiServer = createApiServerFacade()
      multiNsApiServer.createResource(
        'Pod',
        createPod({
          name: 'pod1',
          namespace: 'default',
          containers: [{ name: 'nginx', image: 'nginx:latest' }]
        })
      )
      multiNsApiServer.createResource(
        'Pod',
        createPod({
          name: 'pod2',
          namespace: 'kube-system',
          containers: [{ name: 'kube-proxy', image: 'kube-proxy:latest' }]
        })
      )

      const parsed = createParsedCommand({
        flags: { dump: true, 'all-namespaces': true }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(multiNsApiServer.snapshotState())
      const result = handleClusterInfo(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        // JSON format - check for pod names in JSON
        expect(result.value).toContain('"name": "pod1"')
        expect(result.value).toContain('"name": "pod2"')
        // Should have resources from multiple namespaces
        expect(result.value.split('"kind": "PodList"').length).toBeGreaterThan(
          1
        )
      }
    })

    it('should support -A shorthand for --all-namespaces', () => {
      const parsed = createParsedCommand({
        flags: { dump: true, A: true }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(stateData)
      const result = handleClusterInfo(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        // Should dump all namespaces (JSON format)
        expect(result.value).toContain('"kind": "PodList"')
      }
    })
  })

  describe('--namespaces flag', () => {
    it('should dump only specified namespaces', () => {
      // Add resources in multiple namespaces
      const multiNsApiServer = createApiServerFacade()
      multiNsApiServer.createResource(
        'Namespace',
        createNamespace({ name: 'production' })
      )
      multiNsApiServer.createResource(
        'Namespace',
        createNamespace({ name: 'staging' })
      )
      multiNsApiServer.createResource(
        'Pod',
        createPod({
          name: 'pod1',
          namespace: 'default',
          containers: [{ name: 'nginx', image: 'nginx:latest' }]
        })
      )
      multiNsApiServer.createResource(
        'Pod',
        createPod({
          name: 'pod2',
          namespace: 'production',
          containers: [{ name: 'app', image: 'app:latest' }]
        })
      )
      multiNsApiServer.createResource(
        'Pod',
        createPod({
          name: 'pod3',
          namespace: 'staging',
          containers: [{ name: 'app', image: 'app:latest' }]
        })
      )

      const parsed = createParsedCommand({
        flags: { dump: true, namespaces: 'default,production' }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(multiNsApiServer.snapshotState())
      const result = handleClusterInfo(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        // JSON format - check for pod names
        expect(result.value).toContain('"name": "pod1"')
        expect(result.value).toContain('"name": "pod2"')
        expect(result.value).not.toContain('"name": "pod3"')
      }
    })
  })

  describe('output formats', () => {
    it('should dump in JSON format when --output json is specified', () => {
      const parsed = createParsedCommand({
        flags: { dump: true, output: 'json' }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(stateData)
      const result = handleClusterInfo(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('"apiVersion": "v1"')
        expect(result.value).toContain('"kind": "PodList"')
        expect(result.value).toContain('"name": "test-pod"')
      }
    })

    it('should dump in YAML format when --output yaml is specified', () => {
      const parsed = createParsedCommand({
        flags: { dump: true, output: 'yaml' }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(stateData)
      const result = handleClusterInfo(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('apiVersion: v1')
        expect(result.value).toContain('kind: PodList')
        expect(result.value).toContain('name: test-pod')
      }
    })

    it('should support -o shorthand for --output', () => {
      const parsed = createParsedCommand({
        flags: { dump: true, o: 'json' }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(stateData)
      const result = handleClusterInfo(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('"apiVersion": "v1"')
      }
    })
  })

  describe('--output-directory flag', () => {
    it('should return success message when --output-directory is specified', () => {
      const parsed = createParsedCommand({
        flags: { dump: true, 'output-directory': '/tmp/dump' }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(stateData)
      const result = handleClusterInfo(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('Cluster info dumped to /tmp/dump')
      }
    })

    it('should allow --output-directory=- (stdout)', () => {
      const parsed = createParsedCommand({
        flags: { dump: true, 'output-directory': '-' }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(stateData)
      const result = handleClusterInfo(apiServer, parsed)

      // Should succeed (stdout is allowed)
      expect(result.ok).toBe(true)
    })
  })

  describe('empty cluster', () => {
    it('should handle empty cluster gracefully', () => {
      const emptyState = createClusterStateData()

      const parsed = createParsedCommand({
        flags: { dump: true }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(emptyState)
      const result = handleClusterInfo(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        // JSON format with empty lists
        expect(result.value).toContain('"kind": "NodeList"')
        expect(result.value).toContain('"kind": "PodList"')
        expect(result.value).toContain('"kind": "ConfigMapList"')
        expect(result.value).toContain('"kind": "SecretList"')
        // Lists should be empty
        expect(result.value).toContain('"items": []')
      }
    })
  })

  describe('pods without logs', () => {
    it('should skip logs section when pod has no logs', () => {
      const apiServerWithState = createApiServerFacade()
      apiServerWithState.createResource(
        'Pod',
        createPod({
          name: 'no-logs-pod',
          namespace: 'default',
          containers: [{ name: 'nginx', image: 'nginx:latest' }]
          // No logs provided
        })
      )

      const parsed = createParsedCommand({
        flags: { dump: true }
      })

      const apiServer = createApiServerFacade()
      apiServer.etcd.restore(apiServerWithState.snapshotState())
      const result = handleClusterInfo(apiServer, parsed)

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('"name": "no-logs-pod"')
        // Should not have logs since pod has no logs
        expect(result.value).not.toContain(
          '==== START logs for pod default/no-logs-pod ===='
        )
      }
    })
  })
})
