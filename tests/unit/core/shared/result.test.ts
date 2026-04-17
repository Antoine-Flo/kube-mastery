import { describe, expect, it } from 'vitest'
import { err, ok } from 'neverthrow'
import {
  fromNeverthrowResult,
  success,
  toNeverthrowResult
} from '../../../../src/core/shared/result'

describe('shared result adapters', () => {
  it('converts success result to neverthrow ok', () => {
    const result = success('value')
    const converted = toNeverthrowResult(result)

    expect(converted.isOk()).toBe(true)
    expect(converted._unsafeUnwrap()).toBe('value')
  })

  it('converts neverthrow err to shared error result', () => {
    const converted = fromNeverthrowResult(err('failure'))

    expect(converted.ok).toBe(false)
    if (converted.ok) {
      return
    }
    expect(converted.error).toBe('failure')
  })

  it('converts neverthrow ok to shared success result', () => {
    const converted = fromNeverthrowResult(ok(42))

    expect(converted.ok).toBe(true)
    if (!converted.ok) {
      return
    }
    expect(converted.value).toBe(42)
  })
})
