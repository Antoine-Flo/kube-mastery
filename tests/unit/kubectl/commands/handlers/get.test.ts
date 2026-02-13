import { describe, expect, it } from 'vitest'
import { createNode } from '../../../../../src/core/cluster/ressources/Node'
import { handleGet } from '../../../../../src/core/kubectl/commands/handlers/get'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'
import { createClusterStateData } from '../../../helpers/utils'

describe('kubectl get handler - nodes', () => {
  const createState = () => {
    // Create nodes directly in ClusterStateData for testing
    // (since Node events are not yet implemented)
    const controlPlaneNode = createNode({
      name: 'control-plane',
      labels: {
        'node-role.kubernetes.io/control-plane': '',
        'kubernetes.io/os': 'linux'
      },
      status: {
        nodeInfo: {
          architecture: 'amd64',
          containerRuntimeVersion: 'containerd://2.2.0',
          kernelVersion: '6.6.87.2-microsoft-standard-WSL2',
          kubeletVersion: 'v1.35.0',
          operatingSystem: 'linux',
          osImage: 'Debian GNU/Linux 12 (bookworm)'
        },
        addresses: [
          {
            type: 'InternalIP',
            address: '172.18.0.2'
          },
          {
            type: 'Hostname',
            address: 'control-plane'
          }
        ],
        conditions: [
          {
            type: 'Ready',
            status: 'False',
            reason: 'KubeletNotReady',
            message: 'container runtime network not ready'
          }
        ]
      },
      creationTimestamp: '2024-01-16T18:03:00Z'
    })

    const workerNode = createNode({
      name: 'worker-node-1',
      labels: {
        'node-role.kubernetes.io/worker': '',
        'kubernetes.io/os': 'linux'
      },
      status: {
        nodeInfo: {
          architecture: 'amd64',
          containerRuntimeVersion: 'containerd://1.6.0',
          kernelVersion: '5.15.0',
          kubeletVersion: 'v1.28.0',
          operatingSystem: 'linux',
          osImage: 'Ubuntu 22.04'
        },
        addresses: [
          {
            type: 'InternalIP',
            address: '192.168.1.10'
          },
          {
            type: 'ExternalIP',
            address: '203.0.113.10'
          }
        ],
        conditions: [
          {
            type: 'Ready',
            status: 'True'
          }
        ]
      },
      creationTimestamp: '2024-01-16T18:03:00Z'
    })

    return createClusterStateData({ nodes: [controlPlaneNode, workerNode] })
  }

  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => ({
    action: 'get',
    resource: 'nodes',
    flags: {},
    ...overrides
  })

  describe('table format (default)', () => {
    it('should list nodes in table format', () => {
      const state = createState()
      const parsed = createParsedCommand()

      const result = handleGet(state, parsed)

      expect(result).toContain('NAME')
      expect(result).toContain('STATUS')
      expect(result).toContain('ROLES')
      expect(result).toContain('AGE')
      expect(result).toContain('VERSION')
      expect(result).toContain('control-plane')
      expect(result).toContain('worker-node-1')
      expect(result).toContain('NotReady')
      expect(result).toContain('Ready')
      expect(result).toContain('control-plane')
      expect(result).toContain('worker')
      expect(result).toContain('v1.35.0')
      expect(result).toContain('v1.28.0')
    })

    it('should return "No resources found" when no nodes exist', () => {
      const state = createClusterStateData()
      const parsed = createParsedCommand()

      const result = handleGet(state, parsed)

      expect(result).toBe('No resources found')
    })
  })

  describe('wide format', () => {
    it('should list nodes with wide output format', () => {
      const state = createState()
      const parsed = createParsedCommand({
        flags: { output: 'wide' }
      })

      const result = handleGet(state, parsed)

      expect(result).toContain('NAME')
      expect(result).toContain('STATUS')
      expect(result).toContain('ROLES')
      expect(result).toContain('AGE')
      expect(result).toContain('VERSION')
      expect(result).toContain('INTERNAL-IP')
      expect(result).toContain('EXTERNAL-IP')
      expect(result).toContain('OS-IMAGE')
      expect(result).toContain('KERNEL-VERSION')
      expect(result).toContain('CONTAINER-RUNTIME')
      expect(result).toContain('172.18.0.2')
      expect(result).toContain('192.168.1.10')
      expect(result).toContain('203.0.113.10')
      expect(result).toContain('Debian GNU/Linux 12 (bookworm)')
      expect(result).toContain('Ubuntu 22.04')
      expect(result).toContain('containerd://2.2.0')
      expect(result).toContain('containerd://1.6.0')
    })
  })

  describe('JSON format', () => {
    it('should return nodes in JSON format', () => {
      const state = createState()
      const parsed = createParsedCommand({
        flags: { output: 'json' }
      })

      const result = handleGet(state, parsed)

      expect(result).toContain('"apiVersion": "v1"')
      expect(result).toContain('"kind": "List"')
      expect(result).toContain('"items"')
      expect(result).toContain('"control-plane"')
      expect(result).toContain('"worker-node-1"')
      expect(result).toContain('"kubeletVersion": "v1.35.0"')
      expect(result).toContain('"kubeletVersion": "v1.28.0"')

      // Should be valid JSON
      const parsedJson = JSON.parse(result)
      expect(parsedJson.kind).toBe('List')
      expect(parsedJson.items).toHaveLength(2)
      expect(parsedJson.items[0].metadata.name).toBe('control-plane')
      expect(parsedJson.items[1].metadata.name).toBe('worker-node-1')
    })
  })

  describe('YAML format', () => {
    it('should return nodes in YAML format', () => {
      const state = createState()
      const parsed = createParsedCommand({
        flags: { output: 'yaml' }
      })

      const result = handleGet(state, parsed)

      expect(result).toContain('apiVersion: v1')
      expect(result).toContain('kind: List')
      expect(result).toContain('items:')
      expect(result).toContain('control-plane')
      expect(result).toContain('worker-node-1')
      expect(result).toContain('kubeletVersion: v1.35.0')
      expect(result).toContain('kubeletVersion: v1.28.0')
    })
  })

  describe('cluster-scoped behavior', () => {
    it('should ignore namespace flag for nodes', () => {
      const state = createState()
      const parsed = createParsedCommand({
        namespace: 'default' // Should be ignored for nodes
      })

      const result = handleGet(state, parsed)

      // Should still return all nodes regardless of namespace
      expect(result).toContain('control-plane')
      expect(result).toContain('worker-node-1')
    })
  })

  describe('label selector', () => {
    it('should filter nodes by label selector', () => {
      const state = createState()
      const parsed = createParsedCommand({
        selector: { 'node-role.kubernetes.io/control-plane': '' }
      })

      const result = handleGet(state, parsed)

      expect(result).toContain('control-plane')
      expect(result).not.toContain('worker-node-1')
    })

    it('should filter nodes by worker label', () => {
      const state = createState()
      const parsed = createParsedCommand({
        selector: { 'node-role.kubernetes.io/worker': '' }
      })

      const result = handleGet(state, parsed)

      expect(result).toContain('worker-node-1')
      expect(result).not.toContain('control-plane')
    })
  })
})
