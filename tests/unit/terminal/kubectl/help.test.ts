import { describe, expect, it } from 'vitest'
import { isKubectlHelpRequest } from '../../../../src/core/terminal/kubectl/help'

describe('isKubectlHelpRequest', () => {
  it('returns true for kubectl -h', () => {
    expect(isKubectlHelpRequest('kubectl -h')).toBe(true)
  })

  it('returns true for kubectl get --help', () => {
    expect(isKubectlHelpRequest('kubectl get --help')).toBe(true)
  })

  it('returns false for normal command', () => {
    expect(isKubectlHelpRequest('kubectl get pods')).toBe(false)
  })

  it('returns false for non-kubectl', () => {
    expect(isKubectlHelpRequest('ls -h')).toBe(false)
  })
})
