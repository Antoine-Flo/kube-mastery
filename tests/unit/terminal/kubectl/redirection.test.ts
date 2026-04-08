import { describe, expect, it } from 'vitest'
import {
  parseKubectlOutputRedirection,
  stripInlineShellComment
} from '../../../../src/core/terminal/kubectl/redirection'

describe('stripInlineShellComment', () => {
  it('returns command unchanged when no comment', () => {
    expect(stripInlineShellComment('kubectl get pods')).toBe('kubectl get pods')
  })

  it('strips unquoted hash comment', () => {
    expect(stripInlineShellComment('kubectl get pods # note')).toBe(
      'kubectl get pods'
    )
  })

  it('does not strip hash inside single quotes', () => {
    expect(stripInlineShellComment("kubectl get -l 'a#b'")).toBe(
      "kubectl get -l 'a#b'"
    )
  })

  it('does not strip hash inside double quotes', () => {
    expect(stripInlineShellComment('kubectl get -l "a#b"')).toBe(
      'kubectl get -l "a#b"'
    )
  })
})

describe('parseKubectlOutputRedirection', () => {
  it('parses command without redirection', () => {
    const r = parseKubectlOutputRedirection('kubectl get pods')
    expect(r.ok).toBe(true)
    if (r.ok && r.parsed != null) {
      expect(r.parsed.command).toBe('kubectl get pods')
      expect(r.parsed.outputFile).toBeUndefined()
    }
  })

  it('parses single redirection', () => {
    const r = parseKubectlOutputRedirection('kubectl get pods > out.txt')
    expect(r.ok).toBe(true)
    if (r.ok && r.parsed != null) {
      expect(r.parsed.command).toBe('kubectl get pods')
      expect(r.parsed.outputFile).toBe('out.txt')
    }
  })

  it('rejects multiple redirection operators', () => {
    const r = parseKubectlOutputRedirection('kubectl get pods > a > b')
    expect(r.ok).toBe(false)
  })

  it('ignores greater-than inside quotes', () => {
    const r = parseKubectlOutputRedirection("kubectl get pods -o 'wide>bad'")
    expect(r.ok).toBe(true)
    if (r.ok && r.parsed != null) {
      expect(r.parsed.outputFile).toBeUndefined()
    }
  })
})
