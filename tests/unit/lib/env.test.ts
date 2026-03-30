import { describe, expect, it } from 'vitest'
import { readAppEnv } from '../../../src/lib/env'

describe('readAppEnv', () => {
  it('returns undefined when key is absent in runtime env', () => {
    expect(readAppEnv('FOO', { runtime: { env: {} } })).toBeUndefined()
  })

  it('returns runtime value when present', () => {
    const locals = {
      runtime: { env: { FOO: 'bar' } }
    }
    expect(readAppEnv('FOO', locals)).toBe('bar')
  })

  it('trims runtime string values', () => {
    const locals = {
      runtime: { env: { FOO: '  baz  ' } }
    }
    expect(readAppEnv('FOO', locals)).toBe('baz')
  })
})
