import { describe, expect, it } from 'vitest'
import {
  buildWatchDeltaOutput,
  extractWatchLines
} from '../../../../../src/core/terminal/kubectl/watch/watchDelta'

describe('extractWatchLines', () => {
  it('strips NAME header row when stripTableHeader is true', () => {
    const lines = extractWatchLines('NAME   READY\npod-1  1/1', true)
    expect(lines).toEqual(['pod-1  1/1'])
  })

  it('keeps all lines when stripTableHeader is false', () => {
    const lines = extractWatchLines('NAME   READY\npod-1  1/1', false)
    expect(lines).toEqual(['NAME   READY', 'pod-1  1/1'])
  })
})

describe('buildWatchDeltaOutput', () => {
  it('returns full body minus header on first output when stripTableHeader', () => {
    const d = buildWatchDeltaOutput('', 'NAME   STATUS\na   Running', true)
    expect(d).toBe('a   Running')
  })

  it('emits only new rows when table header stripped', () => {
    const prev = 'NAME   STATUS\na   Running'
    const next = 'NAME   STATUS\na   Running\nb   Pending'
    const d = buildWatchDeltaOutput(prev, next, true)
    expect(d).toBe('b   Pending')
  })

  it('returns empty when no change', () => {
    const prev = 'NAME   STATUS\na   Running'
    const d = buildWatchDeltaOutput(prev, prev, true)
    expect(d).toBe('')
  })
})
