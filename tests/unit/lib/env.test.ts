import { describe, expect, it } from 'vitest'
import { isOpenLearningEnabled } from '../../../src/lib/env'

describe('isOpenLearningEnabled', () => {
  it('returns false when OPEN_LEARNING is absent in runtime env', () => {
    expect(isOpenLearningEnabled({ runtime: { env: {} } })).toBe(false)
  })

  it('returns true when runtime env OPEN_LEARNING is true', () => {
    const locals = {
      runtime: { env: { OPEN_LEARNING: 'true' } }
    }
    expect(isOpenLearningEnabled(locals)).toBe(true)
  })

  it('treats values case-insensitively and ignores surrounding space', () => {
    const locals = {
      runtime: { env: { OPEN_LEARNING: ' TRUE ' } }
    }
    expect(isOpenLearningEnabled(locals)).toBe(true)
  })

  it('returns false for non-true strings', () => {
    const locals = {
      runtime: { env: { OPEN_LEARNING: 'FALSE' } }
    }
    expect(isOpenLearningEnabled(locals)).toBe(false)
  })
})
