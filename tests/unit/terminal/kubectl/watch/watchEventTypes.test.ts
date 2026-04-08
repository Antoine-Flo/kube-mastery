import { describe, expect, it } from 'vitest'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'
import {
  getWatchEventTypes,
  isAllNamespaces,
  isWatchEnabled,
  isWatchOnly
} from '../../../../../src/core/terminal/kubectl/watch/watchEventTypes'

const baseParsed = {
  action: 'get',
  resource: 'pods',
  flags: {},
  rawTokens: [],
  rawPath: null
} as unknown as ParsedCommand

describe('getWatchEventTypes', () => {
  it('returns empty for undefined resource', () => {
    expect(getWatchEventTypes(undefined)).toEqual([])
  })

  it('includes pod lifecycle events for pods', () => {
    const types = getWatchEventTypes('pods')
    expect(types).toContain('PodCreated')
    expect(types).toContain('PodBound')
  })
})

describe('isWatchEnabled', () => {
  it('is true when --watch', () => {
    const p = {
      ...baseParsed,
      flags: { watch: true }
    } as ParsedCommand
    expect(isWatchEnabled(p)).toBe(true)
  })

  it('is true when -w shorthand', () => {
    const p = {
      ...baseParsed,
      flags: { w: true }
    } as ParsedCommand
    expect(isWatchEnabled(p)).toBe(true)
  })

  it('is false without watch flags', () => {
    expect(isWatchEnabled(baseParsed)).toBe(false)
  })
})

describe('isWatchOnly', () => {
  it('is true for watch-only flag', () => {
    const p = {
      ...baseParsed,
      flags: { 'watch-only': true }
    } as ParsedCommand
    expect(isWatchOnly(p)).toBe(true)
  })
})

describe('isAllNamespaces', () => {
  it('is true for -A', () => {
    const p = {
      ...baseParsed,
      flags: { A: true }
    } as ParsedCommand
    expect(isAllNamespaces(p)).toBe(true)
  })
})
