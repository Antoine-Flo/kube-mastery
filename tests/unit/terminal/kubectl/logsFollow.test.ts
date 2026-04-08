import { describe, expect, it } from 'vitest'
import { buildLogsFollowDeltaOutput } from '../../../../src/core/terminal/kubectl/logsFollow'

describe('buildLogsFollowDeltaOutput', () => {
  it('returns next full output when previous empty', () => {
    expect(buildLogsFollowDeltaOutput('', 'line1\nline2')).toBe('line1\nline2')
  })

  it('returns only appended lines', () => {
    const prev = 'a\nb'
    const next = 'a\nb\nc'
    expect(buildLogsFollowDeltaOutput(prev, next)).toBe('c')
  })

  it('returns empty when identical', () => {
    expect(buildLogsFollowDeltaOutput('a\nb', 'a\nb')).toBe('')
  })

  it('returns empty when next is shorter', () => {
    expect(buildLogsFollowDeltaOutput('a\nb\nc', 'a\nb')).toBe('')
  })
})
