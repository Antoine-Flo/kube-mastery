import { describe, expect, it } from 'vitest'
import { stripNumericPrefix, parseH1 } from '../../../src/content/utils'

describe('stripNumericPrefix', () => {
  it('strips numeric prefix with leading zero and dash', () => {
    expect(stripNumericPrefix('01-onboarding')).toBe('onboarding')
  })

  it('strips single digit prefix with dash', () => {
    expect(stripNumericPrefix('1-task')).toBe('task')
  })

  it('returns unchanged when no numeric prefix', () => {
    expect(stripNumericPrefix('onboarding')).toBe('onboarding')
    expect(stripNumericPrefix('task-id')).toBe('task-id')
  })

  it('returns empty string for empty input', () => {
    expect(stripNumericPrefix('')).toBe('')
  })
})

describe('parseH1', () => {
  it('extracts first H1 from markdown', () => {
    expect(parseH1('# Title\n\nSome content')).toBe('Title')
  })

  it('trims spaces in H1', () => {
    expect(parseH1('#  Title  ')).toBe('Title')
  })

  it('returns empty string when no H1', () => {
    expect(parseH1('No hash here')).toBe('')
    expect(parseH1('Plain text')).toBe('')
  })

  it('returns empty string for empty input', () => {
    expect(parseH1('')).toBe('')
  })
})
