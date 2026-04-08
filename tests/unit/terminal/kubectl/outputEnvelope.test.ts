import { describe, expect, it } from 'vitest'
import {
  KUBECTL_STDERR_PREFIX,
  parseKubectlOutputEnvelope
} from '../../../../src/core/terminal/kubectl/outputEnvelope'

describe('parseKubectlOutputEnvelope', () => {
  it('returns full string as payload without prefix', () => {
    const r = parseKubectlOutputEnvelope('NAME   READY\npod-1  1/1')
    expect(r.payload).toBe('NAME   READY\npod-1  1/1')
    expect(r.stderrNotice).toBeUndefined()
  })

  it('decodes stderr notice and splits payload', () => {
    const encoded = encodeURIComponent('warning: foo')
    const raw = `${KUBECTL_STDERR_PREFIX}${encoded}\nNAME   READY`
    const r = parseKubectlOutputEnvelope(raw)
    expect(r.stderrNotice).toBe('warning: foo')
    expect(r.payload).toBe('NAME   READY')
  })

  it('falls back to full output on invalid URI encoding', () => {
    const raw = `${KUBECTL_STDERR_PREFIX}%ZZ\nrest`
    const r = parseKubectlOutputEnvelope(raw)
    expect(r.payload).toBe(raw)
  })
})
