import { beforeEach, describe, expect, it } from 'vitest'
import type { AutocompleteContext } from '../../../../src/core/terminal/autocomplete/types'
import { KubectlAutocompleteProvider } from '../../../../src/core/kubectl/autocomplete/KubectlAutocompleteProvider'

describe('KubectlAutocompleteProvider', () => {
  let provider: KubectlAutocompleteProvider
  let mockContext: AutocompleteContext

  beforeEach(() => {
    provider = new KubectlAutocompleteProvider()
    mockContext = {
      clusterState: {
        getPods: () => [
          { metadata: { name: 'nginx-1' } },
          { metadata: { name: 'nginx-2' } },
          { metadata: { name: 'redis-1' } }
        ],
        getConfigMaps: () => [
          { metadata: { name: 'app-config' } },
          { metadata: { name: 'db-config' } }
        ],
        getSecrets: () => [
          { metadata: { name: 'db-secret' } },
          { metadata: { name: 'api-secret' } }
        ]
      },
      fileSystem: {
        getCurrentPath: () => '/home/kube'
      }
    }
  })

  describe('priority', () => {
    it('should return 20', () => {
      expect(provider.priority()).toBe(20)
    })
  })

  describe('match', () => {
    it('should match when first token is kubectl', () => {
      expect(provider.match(['kubectl'], '', 'kubectl')).toBe(true)
    })

    it('should not match when first token is not kubectl', () => {
      expect(provider.match(['cd'], '', 'cd')).toBe(false)
      expect(provider.match(['ls'], '', 'ls')).toBe(false)
    })

    it('should match at position 1 (action) when tokens.length === 1', () => {
      expect(provider.match(['kubectl'], '', 'kubectl')).toBe(true)
    })

    it('should match at position 1 (action) when tokens.length === 2 and line does not end with space', () => {
      expect(provider.match(['kubectl', 'get'], 'get', 'kubectl get')).toBe(
        true
      )
    })

    it('should match at position 2 (resource type) when line ends with space', () => {
      // When line ends with space and tokens.length === 2, we're at position 2 (resource type)
      expect(provider.match(['kubectl', 'get'], '', 'kubectl get ')).toBe(true)
    })

    it('should match at position 2 (resource type) for non-logs/exec actions', () => {
      expect(provider.match(['kubectl', 'get'], 'get', 'kubectl get')).toBe(
        true
      )
      expect(
        provider.match(['kubectl', 'get', 'pods'], 'pods', 'kubectl get pods')
      ).toBe(true)
    })

    it('should match at position 2 (resource type) when tokens.length === 2', () => {
      expect(provider.match(['kubectl', 'get'], 'get', 'kubectl get')).toBe(
        true
      )
    })

    it('should match at position 2 (resource type) when tokens.length === 3 and line does not end with space', () => {
      expect(
        provider.match(['kubectl', 'get', 'pods'], 'pods', 'kubectl get pods')
      ).toBe(true)
    })

    it('should match at position 2 (pod name) for logs action', () => {
      expect(provider.match(['kubectl', 'logs'], '', 'kubectl logs')).toBe(true)
      expect(
        provider.match(
          ['kubectl', 'logs', 'nginx-1'],
          'nginx-1',
          'kubectl logs nginx-1'
        )
      ).toBe(true)
    })

    it('should match at position 2 (pod name) for exec action', () => {
      expect(provider.match(['kubectl', 'exec'], '', 'kubectl exec')).toBe(true)
      expect(
        provider.match(
          ['kubectl', 'exec', 'nginx-1'],
          'nginx-1',
          'kubectl exec nginx-1'
        )
      ).toBe(true)
    })

    it('should match at position 3 (resource name) for non-logs/exec actions', () => {
      expect(
        provider.match(
          ['kubectl', 'get', 'pods', 'nginx-1'],
          'nginx-1',
          'kubectl get pods nginx-1'
        )
      ).toBe(true)
    })

    it('should match at position 3+ for resource names', () => {
      expect(
        provider.match(
          ['kubectl', 'get', 'pods', 'nginx-1', 'extra'],
          'extra',
          'kubectl get pods nginx-1 extra'
        )
      ).toBe(true)
    })
  })

  describe('complete', () => {
    describe('position 1 (action)', () => {
      it('should return empty array when action prefix is ambiguous (empty)', () => {
        const results = provider.complete(['kubectl'], '', mockContext)
        expect(results).toEqual([])
      })

      it('should filter actions by prefix', () => {
        const results = provider.complete(['kubectl'], 'g', mockContext)
        expect(results).toEqual([{ text: 'get', suffix: ' ' }])
      })

      it('should return empty array for ambiguous action prefix', () => {
        const results = provider.complete(['kubectl'], 'd', mockContext)
        expect(results).toEqual([])
      })

      it('should return empty array for unknown prefix', () => {
        const results = provider.complete(['kubectl'], 'xyz', mockContext)
        expect(results).toEqual([])
      })

      it('should complete create action with unique prefix', () => {
        const results = provider.complete(['kubectl'], 'cre', mockContext)
        expect(results).toEqual([{ text: 'create', suffix: ' ' }])
      })

      it('should complete replace action with unique prefix', () => {
        const results = provider.complete(['kubectl'], 'rep', mockContext)
        expect(results).toEqual([{ text: 'replace', suffix: ' ' }])
      })

      it('should complete set action with unique prefix', () => {
        const results = provider.complete(['kubectl'], 'se', mockContext)
        expect(results).toEqual([{ text: 'set', suffix: ' ' }])
      })

      it('should complete edit action with unique prefix', () => {
        const results = provider.complete(['kubectl'], 'ed', mockContext)
        expect(results).toEqual([{ text: 'edit', suffix: ' ' }])
      })
    })

    describe('position 2 (resource type) for non-logs/exec actions', () => {
      it('should return empty array when resource prefix is ambiguous (empty)', () => {
        const results = provider.complete(['kubectl', 'get'], '', mockContext)
        expect(results).toEqual([])
      })

      it('should complete canonical resource type when prefix is unique', () => {
        const results = provider.complete(['kubectl', 'get'], 'p', mockContext)
        expect(results).toEqual([{ text: 'pods', suffix: ' ' }])
      })

      it('should return empty array when no canonical resource matches prefix', () => {
        const results = provider.complete(['kubectl', 'get'], 'cm', mockContext)
        expect(results).toEqual([])
      })

      it('should return empty array for ambiguous typed resource token', () => {
        const results = provider.complete(
          ['kubectl', 'get', 'd'],
          'd',
          mockContext
        )
        expect(results).toEqual([])
      })

      it('should complete typed resource token when unique on canonical kind', () => {
        const results = provider.complete(
          ['kubectl', 'get', 'depl'],
          'depl',
          mockContext
        )
        expect(results).toEqual([{ text: 'deployments', suffix: ' ' }])
      })
    })

    describe('position 2 (pod name) for logs/exec actions', () => {
      it('should return pod names for logs action', () => {
        const results = provider.complete(['kubectl', 'logs'], '', mockContext)
        expect(results).toContainEqual({ text: 'nginx-1', suffix: ' ' })
        expect(results).toContainEqual({ text: 'nginx-2', suffix: ' ' })
        expect(results).toContainEqual({ text: 'redis-1', suffix: ' ' })
      })

      it('should return pod names for exec action', () => {
        const results = provider.complete(['kubectl', 'exec'], '', mockContext)
        expect(results).toContainEqual({ text: 'nginx-1', suffix: ' ' })
        expect(results).toContainEqual({ text: 'nginx-2', suffix: ' ' })
        expect(results).toContainEqual({ text: 'redis-1', suffix: ' ' })
      })

      it('should filter pod names by prefix for logs', () => {
        const results = provider.complete(
          ['kubectl', 'logs'],
          'ngin',
          mockContext
        )
        expect(results).toContainEqual({ text: 'nginx-1', suffix: ' ' })
        expect(results).toContainEqual({ text: 'nginx-2', suffix: ' ' })
        expect(results).not.toContainEqual({ text: 'redis-1', suffix: ' ' })
      })

      it('should filter pod names by prefix for exec', () => {
        const results = provider.complete(
          ['kubectl', 'exec'],
          'red',
          mockContext
        )
        expect(results).toContainEqual({ text: 'redis-1', suffix: ' ' })
        expect(results).not.toContainEqual({ text: 'nginx-1', suffix: ' ' })
      })
    })

    describe('position 3+ (resource names)', () => {
      it('should return pod names for pods resource type', () => {
        const results = provider.complete(
          ['kubectl', 'get', 'pods'],
          '',
          mockContext
        )
        expect(results).toContainEqual({ text: 'nginx-1', suffix: ' ' })
        expect(results).toContainEqual({ text: 'nginx-2', suffix: ' ' })
        expect(results).toContainEqual({ text: 'redis-1', suffix: ' ' })
      })

      it('should return pod names for pod alias', () => {
        const results = provider.complete(
          ['kubectl', 'get', 'pod'],
          '',
          mockContext
        )
        expect(results).toContainEqual({ text: 'nginx-1', suffix: ' ' })
      })

      it('should return pod names for po alias', () => {
        const results = provider.complete(
          ['kubectl', 'get', 'po'],
          '',
          mockContext
        )
        expect(results).toContainEqual({ text: 'nginx-1', suffix: ' ' })
      })

      it('should return configmap names for configmaps resource type', () => {
        const results = provider.complete(
          ['kubectl', 'get', 'configmaps'],
          '',
          mockContext
        )
        expect(results).toContainEqual({ text: 'app-config', suffix: ' ' })
        expect(results).toContainEqual({ text: 'db-config', suffix: ' ' })
      })

      it('should return configmap names for configmap alias', () => {
        const results = provider.complete(
          ['kubectl', 'get', 'configmap'],
          '',
          mockContext
        )
        expect(results).toContainEqual({ text: 'app-config', suffix: ' ' })
      })

      it('should return configmap names for cm alias', () => {
        const results = provider.complete(
          ['kubectl', 'get', 'cm'],
          '',
          mockContext
        )
        expect(results).toContainEqual({ text: 'app-config', suffix: ' ' })
      })

      it('should return secret names for secrets resource type', () => {
        const results = provider.complete(
          ['kubectl', 'get', 'secrets'],
          '',
          mockContext
        )
        expect(results).toContainEqual({ text: 'db-secret', suffix: ' ' })
        expect(results).toContainEqual({ text: 'api-secret', suffix: ' ' })
      })

      it('should return secret names for secret alias', () => {
        const results = provider.complete(
          ['kubectl', 'get', 'secret'],
          '',
          mockContext
        )
        expect(results).toContainEqual({ text: 'db-secret', suffix: ' ' })
      })

      it('should return node names for nodes resource type', () => {
        const contextWithNodes = {
          ...mockContext,
          clusterState: {
            ...mockContext.clusterState,
            getNodes: () => [
              { metadata: { name: 'control-plane' } },
              { metadata: { name: 'worker-node-1' } }
            ]
          }
        }
        const results = provider.complete(
          ['kubectl', 'get', 'nodes'],
          '',
          contextWithNodes
        )
        expect(results).toContainEqual({ text: 'control-plane', suffix: ' ' })
        expect(results).toContainEqual({ text: 'worker-node-1', suffix: ' ' })
      })

      it('should return node names for node alias', () => {
        const contextWithNodes = {
          ...mockContext,
          clusterState: {
            ...mockContext.clusterState,
            getNodes: () => [{ metadata: { name: 'control-plane' } }]
          }
        }
        const results = provider.complete(
          ['kubectl', 'get', 'node'],
          '',
          contextWithNodes
        )
        expect(results).toContainEqual({ text: 'control-plane', suffix: ' ' })
      })

      it('should return node names for no alias', () => {
        const contextWithNodes = {
          ...mockContext,
          clusterState: {
            ...mockContext.clusterState,
            getNodes: () => [{ metadata: { name: 'worker-node-1' } }]
          }
        }
        const results = provider.complete(
          ['kubectl', 'get', 'no'],
          '',
          contextWithNodes
        )
        expect(results).toContainEqual({ text: 'worker-node-1', suffix: ' ' })
      })

      it('should filter node names by prefix', () => {
        const contextWithNodes = {
          ...mockContext,
          clusterState: {
            ...mockContext.clusterState,
            getNodes: () => [
              { metadata: { name: 'control-plane' } },
              { metadata: { name: 'worker-node-1' } }
            ]
          }
        }
        const results = provider.complete(
          ['kubectl', 'get', 'nodes'],
          'work',
          contextWithNodes
        )
        expect(results).toContainEqual({ text: 'worker-node-1', suffix: ' ' })
        expect(results).not.toContainEqual({
          text: 'control-plane',
          suffix: ' '
        })
      })

      // Note: getNodes is now part of ClusterState interface, so this test is no longer needed
      // If getNodes is missing, the type guard at the start of getResourceNames will catch it

      it('should filter resource names by prefix', () => {
        const results = provider.complete(
          ['kubectl', 'get', 'pods'],
          'ngin',
          mockContext
        )
        expect(results).toContainEqual({ text: 'nginx-1', suffix: ' ' })
        expect(results).toContainEqual({ text: 'nginx-2', suffix: ' ' })
        expect(results).not.toContainEqual({ text: 'redis-1', suffix: ' ' })
      })

      it('should return empty array for unknown resource type', () => {
        const results = provider.complete(
          ['kubectl', 'get', 'unknown'],
          '',
          mockContext
        )
        expect(results).toEqual([])
      })

      it('should return empty array for ambiguous resource type step', () => {
        const results = provider.complete(['kubectl', 'get'], '', mockContext)
        expect(results).toEqual([])
      })
    })

    describe('edge cases', () => {
      it('should return empty array when clusterState is missing', () => {
        const contextWithoutClusterState: AutocompleteContext = {
          clusterState: null as any,
          fileSystem: mockContext.fileSystem
        }
        const results = provider.complete(
          ['kubectl', 'get', 'pods'],
          '',
          contextWithoutClusterState
        )
        expect(results).toEqual([])
      })

      it('should return empty array when clusterState does not have getPods method', () => {
        const contextWithoutMethods: AutocompleteContext = {
          clusterState: {} as any,
          fileSystem: mockContext.fileSystem
        }
        const results = provider.complete(
          ['kubectl', 'get', 'pods'],
          '',
          contextWithoutMethods
        )
        expect(results).toEqual([])
      })

      it('should handle empty resource lists', () => {
        const emptyContext: AutocompleteContext = {
          clusterState: {
            getPods: () => [],
            getConfigMaps: () => [],
            getSecrets: () => []
          },
          fileSystem: mockContext.fileSystem
        }
        const results = provider.complete(
          ['kubectl', 'get', 'pods'],
          '',
          emptyContext
        )
        expect(results).toEqual([])
      })
    })
  })

  describe('edge cases / error scenarios', () => {
    describe('match() edge cases', () => {
      it('should not match when tokens[0] is undefined', () => {
        expect(provider.match([undefined as any], '', '')).toBe(false)
      })

      it('should not match when tokens is empty array', () => {
        expect(provider.match([], '', '')).toBe(false)
      })

      it('should handle action undefined (tokens[1] missing)', () => {
        // When tokens.length === 1, action is undefined but should still match
        expect(provider.match(['kubectl'], '', 'kubectl')).toBe(true)
      })

      it('should handle resourceType not in RESOURCE_ALIASES but valid', () => {
        // Unknown resource type should still match at position 3
        expect(
          provider.match(
            ['kubectl', 'get', 'unknown'],
            'unknown',
            'kubectl get unknown'
          )
        ).toBe(true)
      })

      it('should handle line with special characters', () => {
        expect(provider.match(['kubectl', 'get'], 'get', 'kubectl get!')).toBe(
          true
        )
      })
    })

    describe('complete() edge cases', () => {
      it('should handle all pod aliases (po, pod, pods)', () => {
        const results1 = provider.complete(
          ['kubectl', 'get', 'po'],
          '',
          mockContext
        )
        const results2 = provider.complete(
          ['kubectl', 'get', 'pod'],
          '',
          mockContext
        )
        const results3 = provider.complete(
          ['kubectl', 'get', 'pods'],
          '',
          mockContext
        )

        expect(results1).toContainEqual({ text: 'nginx-1', suffix: ' ' })
        expect(results2).toContainEqual({ text: 'nginx-1', suffix: ' ' })
        expect(results3).toContainEqual({ text: 'nginx-1', suffix: ' ' })
      })

      it('should handle all configmap aliases (cm, configmap, configmaps)', () => {
        const results1 = provider.complete(
          ['kubectl', 'get', 'cm'],
          '',
          mockContext
        )
        const results2 = provider.complete(
          ['kubectl', 'get', 'configmap'],
          '',
          mockContext
        )
        const results3 = provider.complete(
          ['kubectl', 'get', 'configmaps'],
          '',
          mockContext
        )

        expect(results1).toContainEqual({ text: 'app-config', suffix: ' ' })
        expect(results2).toContainEqual({ text: 'app-config', suffix: ' ' })
        expect(results3).toContainEqual({ text: 'app-config', suffix: ' ' })
      })

      it('should handle pods with undefined metadata.name', () => {
        const contextWithInvalidPods: AutocompleteContext = {
          clusterState: {
            getPods: () => [
              { metadata: { name: 'valid-pod' } },
              { metadata: {} }, // Missing name - maps to undefined
              { metadata: { name: undefined } } // Explicitly undefined
            ],
            getConfigMaps: () => [],
            getSecrets: () => []
          },
          fileSystem: mockContext.fileSystem
        }

        const results = provider.complete(
          ['kubectl', 'get', 'pods'],
          '',
          contextWithInvalidPods
        )
        // Current implementation doesn't filter undefined/empty names
        // It maps all pods including those with undefined names
        expect(results).toContainEqual({ text: 'valid-pod', suffix: ' ' })
        expect(results).toContainEqual({ text: undefined, suffix: ' ' })
        expect(results.length).toBe(3) // All pods are included
      })

      it('should handle resources with empty names', () => {
        const contextWithEmptyNames: AutocompleteContext = {
          clusterState: {
            getPods: () => [
              { metadata: { name: '' } },
              { metadata: { name: 'valid-pod' } }
            ],
            getConfigMaps: () => [],
            getSecrets: () => []
          },
          fileSystem: mockContext.fileSystem
        }

        const results = provider.complete(
          ['kubectl', 'get', 'pods'],
          '',
          contextWithEmptyNames
        )
        // Current implementation doesn't filter empty names
        // It includes all names including empty strings
        expect(results).toContainEqual({ text: 'valid-pod', suffix: ' ' })
        expect(results).toContainEqual({ text: '', suffix: ' ' })
        expect(results.length).toBe(2) // Both pods are included
      })

      it('should handle very long resource list (>100 resources)', () => {
        const manyPods = Array.from({ length: 150 }, (_, i) => ({
          metadata: { name: `pod-${i}` }
        }))

        const contextWithManyPods: AutocompleteContext = {
          clusterState: {
            getPods: () => manyPods,
            getConfigMaps: () => [],
            getSecrets: () => []
          },
          fileSystem: mockContext.fileSystem
        }

        const results = provider.complete(
          ['kubectl', 'get', 'pods'],
          '',
          contextWithManyPods
        )
        expect(results.length).toBe(150)
        expect(results[0]).toEqual({ text: 'pod-0', suffix: ' ' })
        expect(results[149]).toEqual({ text: 'pod-149', suffix: ' ' })
      })

      it('should handle filtering with prefix that matches nothing', () => {
        const results = provider.complete(
          ['kubectl', 'get', 'pods'],
          'xyz-nonexistent',
          mockContext
        )
        expect(results).toEqual([])
      })

      it('should handle case-sensitive filtering', () => {
        const contextWithMixedCase: AutocompleteContext = {
          clusterState: {
            getPods: () => [
              { metadata: { name: 'nginx-1' } },
              { metadata: { name: 'Nginx-1' } }
            ],
            getConfigMaps: () => [],
            getSecrets: () => []
          },
          fileSystem: mockContext.fileSystem
        }

        const results = provider.complete(
          ['kubectl', 'get', 'pods'],
          'N',
          contextWithMixedCase
        )
        expect(results).toContainEqual({ text: 'Nginx-1', suffix: ' ' })
        expect(results).not.toContainEqual({ text: 'nginx-1', suffix: ' ' })
      })
    })
  })
})
