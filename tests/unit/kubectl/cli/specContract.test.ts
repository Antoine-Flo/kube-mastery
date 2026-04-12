import { describe, expect, it } from 'vitest'
import { parseCommand } from '../../../../src/core/kubectl/commands/parser'
import { resolveKubectlHelpFromSpec } from '../../../../src/core/kubectl/cli/runtime/help'
import { getKubectlSupportMatrix } from '../../../../src/core/kubectl/cli/runtime/supportMatrix'
import { assertParsedCommandSupportedBySpec } from '../../../../src/core/kubectl/cli/runtime/parse'
import { completeKubectlFromSpec } from '../../../../src/core/kubectl/cli/runtime/completion'

describe('kubectl cli spec contracts', () => {
  it('exposes support matrix entries for nested commands', () => {
    const matrix = getKubectlSupportMatrix()
    const paths = matrix.map((entry) => entry.path)
    expect(paths).toContain('rollout status')
    expect(paths).toContain('config view')
  })

  it('generates help from the command spec', () => {
    const help = resolveKubectlHelpFromSpec('kubectl explain --help')
    expect(help).toBeDefined()
    expect(help).toContain('Describe fields and structure of various resources')
    expect(help).toContain('kubectl explain')
  })

  it('provides command completion from the command spec', () => {
    const suggestions = completeKubectlFromSpec('kubectl pat')
    expect(suggestions).toEqual([{ text: 'patch', suffix: ' ' }])
  })

  it('completes create clusterrole from partial subcommand', () => {
    const suggestions = completeKubectlFromSpec('kubectl create cluste')
    expect(suggestions).toEqual([{ text: 'clusterrole', suffix: ' ' }])
  })

  it('keeps parser results aligned with command spec handler', () => {
    const parsedResult = parseCommand('kubectl api-versions')
    expect(parsedResult.ok).toBe(true)
    if (!parsedResult.ok) {
      return
    }
    const supportResult = assertParsedCommandSupportedBySpec(
      'kubectl api-versions',
      parsedResult.value
    )
    expect(supportResult.ok).toBe(true)
  })

  it('renders official example for cluster-info from refs', () => {
    const help = resolveKubectlHelpFromSpec('kubectl cluster-info --help')
    expect(help).toBeDefined()
    expect(help).toContain('Display addresses of the control plane')
    expect(help).toContain('kubectl cluster-info')
  })
})
