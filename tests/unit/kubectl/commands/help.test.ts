import { describe, expect, it } from 'vitest'
import { resolveKubectlHelp } from '../../../../src/core/kubectl/commands/help'

describe('kubectl help resolver', () => {
  it('should return explain help text', () => {
    const output = resolveKubectlHelp('kubectl explain --help')

    expect(output).toBeDefined()
    expect(output).toContain('Get documentation for a resource.')
    expect(output).toContain('kubectl explain TYPE')
  })

  it('should include explain command in root help', () => {
    const output = resolveKubectlHelp('kubectl -h')

    expect(output).toBeDefined()
    expect(output).toContain('explain')
  })

  it('should return diff help text', () => {
    const output = resolveKubectlHelp('kubectl diff --help')

    expect(output).toBeDefined()
    expect(output).toContain('Diff configurations specified by file name')
    expect(output).toContain('kubectl diff -f FILENAME')
  })

  it('should include diff command in root help', () => {
    const output = resolveKubectlHelp('kubectl --help')

    expect(output).toBeDefined()
    expect(output).toContain('diff')
  })

  it('should return config help text', () => {
    const output = resolveKubectlHelp('kubectl config --help')

    expect(output).toBeDefined()
    expect(output).toContain('Modify kubeconfig files.')
    expect(output).toContain('kubectl config get-contexts')
  })

  it('should include config command in root help', () => {
    const output = resolveKubectlHelp('kubectl --help')

    expect(output).toBeDefined()
    expect(output).toContain('config')
  })
})
