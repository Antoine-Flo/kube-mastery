import { describe, expect, it } from 'vitest'
import {
  resolveUniqueKubectlResourceKind,
  resolveUniqueKubectlResourceKindAllowlist
} from '../../../../src/core/kubectl/commands/resourceCatalog'

describe('resolveUniqueKubectlResourceKind', () => {
  it('returns null for empty prefix', () => {
    expect(resolveUniqueKubectlResourceKind('')).toBeNull()
  })

  it('resolves unambiguous canonical prefix', () => {
    expect(resolveUniqueKubectlResourceKind('namespa')).toBe('namespaces')
  })

  it('resolves unambiguous alias', () => {
    expect(resolveUniqueKubectlResourceKind('ns')).toBe('namespaces')
    expect(resolveUniqueKubectlResourceKind('cm')).toBe('configmaps')
  })

  it('returns null when multiple kinds match', () => {
    expect(resolveUniqueKubectlResourceKind('p')).toBeNull()
  })
})

describe('resolveUniqueKubectlResourceKindAllowlist', () => {
  it('restricts to rollout kinds', () => {
    expect(
      resolveUniqueKubectlResourceKindAllowlist('depl', [
        'deployments',
        'daemonsets',
        'statefulsets'
      ])
    ).toBe('deployments')
  })
})
