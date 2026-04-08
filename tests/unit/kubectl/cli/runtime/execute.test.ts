import { describe, expect, it } from 'vitest'
import { parseCommand } from '~/core/kubectl/commands/parser'
import { runKubectlCommandHooks } from '~/core/kubectl/cli/runtime/execute'
import { expectErr } from '../../../helpers/resultAssertions'

describe('runKubectlCommandHooks', () => {
  it('returns parse resolution error', () => {
    const parsedResult = parseCommand('kubectl get pods')
    expect(parsedResult.ok).toBe(true)
    if (!parsedResult.ok) {
      return
    }
    const result = runKubectlCommandHooks('', parsedResult.value)
    const errorMessage = expectErr(result)
    expect(errorMessage).toContain('Invalid or missing action')
  })

  it('succeeds when hooks are absent', () => {
    const parsedResult = parseCommand('kubectl get pods')
    expect(parsedResult.ok).toBe(true)
    if (!parsedResult.ok) {
      return
    }
    const result = runKubectlCommandHooks('kubectl get pods', parsedResult.value)
    expect(result.ok).toBe(true)
  })
})
