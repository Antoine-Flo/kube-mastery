import { describe, expect, it } from 'vitest'
import {
  applyDescribeTabWriter,
  tabbedStringSync
} from '../../../../src/core/kubectl/printers/describeTabWriter'

describe('describeTabWriter', () => {
  it('aligns tab-separated columns in a block', () => {
    const input = ['Name:\tfoo', 'Kind:\tbar'].join('\n')
    const out = applyDescribeTabWriter(input)
    expect(out).toContain('Name:')
    expect(out).toContain('foo')
    expect(out).toContain('Kind:')
    expect(out).toContain('bar')
  })

  it('tabbedStringSync collects writes and formats', () => {
    const out = tabbedStringSync((sink) => {
      sink.write('Name:\tvalue-a\n')
      sink.write('Kind:\tvalue-b\n')
    })
    expect(out.split('\n').length).toBeGreaterThanOrEqual(2)
  })
})
