import { describe, expect, it } from 'vitest'
import {
  expandRolloutStatusOutput,
  isRolloutStatusSuccessOutput,
  parseRolloutProgress
} from '../../../../src/core/terminal/kubectl/rolloutFollow'

describe('isRolloutStatusSuccessOutput', () => {
  it('detects success phrase', () => {
    expect(
      isRolloutStatusSuccessOutput('deployment "web" successfully rolled out')
    ).toBe(true)
  })

  it('returns false without phrase', () => {
    expect(isRolloutStatusSuccessOutput('Waiting for deployment')).toBe(false)
  })
})

describe('parseRolloutProgress', () => {
  it('parses available replicas line', () => {
    const line =
      'Waiting for deployment "web" rollout to finish: 2 of 3 updated replicas are available...'
    const s = parseRolloutProgress(line)
    expect(s).toEqual({
      deploymentName: 'web',
      current: 2,
      desired: 3,
      mode: 'available'
    })
  })

  it('parses updated replicas line', () => {
    const line =
      'Waiting for deployment "web" rollout to finish: 1 out of 3 new replicas have been updated...'
    const s = parseRolloutProgress(line)
    expect(s).toEqual({
      deploymentName: 'web',
      current: 1,
      desired: 3,
      mode: 'updated'
    })
  })
})

describe('expandRolloutStatusOutput', () => {
  it('expands skipped progress steps for available mode', () => {
    const prev =
      'Waiting for deployment "web" rollout to finish: 1 of 3 updated replicas are available...'
    const next =
      'Waiting for deployment "web" rollout to finish: 3 of 3 updated replicas are available...'
    const lines = expandRolloutStatusOutput(prev, next)
    expect(lines.length).toBe(2)
    expect(lines[0]).toContain('2 of 3')
    expect(lines[1]).toContain('3 of 3')
  })

  it('returns single line when previous not parseable', () => {
    const lines = expandRolloutStatusOutput('other', 'Waiting...')
    expect(lines).toEqual(['Waiting...'])
  })
})
