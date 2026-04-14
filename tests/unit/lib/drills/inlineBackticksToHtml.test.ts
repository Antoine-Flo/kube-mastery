import { describe, expect, it } from 'vitest'
import {
  drillSolutionTextToHtml,
  inlineBackticksToHtml
} from '../../../../src/lib/drills/inlineBackticksToHtml'

describe('inlineBackticksToHtml', () => {
  it('wraps one segment', () => {
    expect(inlineBackticksToHtml('see `pv.yaml` now')).toBe(
      'see <code>pv.yaml</code> now'
    )
  })

  it('escapes html in plain and in code', () => {
    expect(inlineBackticksToHtml('a <b> `c<d`')).toBe(
      'a &lt;b&gt; <code>c&lt;d</code>'
    )
  })

  it('handles unclosed backtick as text', () => {
    expect(inlineBackticksToHtml('x `y')).toBe('x `y')
  })
})

describe('drillSolutionTextToHtml', () => {
  it('passes through anchor tags and escapes the rest', () => {
    expect(
      drillSolutionTextToHtml(
        'See <a href="https://x.com/a" target="_blank" rel="noopener noreferrer">lesson</a> and `pod.yaml`.'
      )
    ).toBe(
      'See <a href="https://x.com/a" target="_blank" rel="noopener noreferrer">lesson</a> and <code>pod.yaml</code>.'
    )
  })
})
