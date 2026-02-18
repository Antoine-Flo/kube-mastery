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
})
