import { expect } from 'vitest'

type ResultLike<T, E = string> = { ok: true; value: T } | { ok: false; error: E }

export const expectOk = <T, E = string>(result: ResultLike<T, E>): T => {
  expect(result.ok).toBe(true)
  if (!result.ok) {
    throw new Error(`Expected ok result, received error: ${String(result.error)}`)
  }
  return result.value
}

export const expectErr = <T, E = string>(result: ResultLike<T, E>): E => {
  expect(result.ok).toBe(false)
  if (result.ok) {
    throw new Error('Expected error result, received ok result')
  }
  return result.error
}
