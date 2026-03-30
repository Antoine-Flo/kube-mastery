import { describe, expect, it } from 'vitest'
import {
  getFirstNonPlaceholderLessonIdFromSections,
  isLessonTerminalInteractive
} from '../../../src/lib/courses/lessonTerminalAccess'

describe('isLessonTerminalInteractive', () => {
  it('returns true without session for free learnable', () => {
    expect(
      isLessonTerminalInteractive({
        overviewType: 'courses',
        hasUserSession: false,
        learnableIsFree: true,
        hasPaidSubscription: true
      })
    ).toBe(true)
  })

  it('returns true for free course with session even without paid subscription', () => {
    expect(
      isLessonTerminalInteractive({
        overviewType: 'courses',
        hasUserSession: true,
        learnableIsFree: true,
        hasPaidSubscription: false
      })
    ).toBe(true)
  })

  it('returns true for paid course with session and paid subscription', () => {
    expect(
      isLessonTerminalInteractive({
        overviewType: 'courses',
        hasUserSession: true,
        learnableIsFree: false,
        hasPaidSubscription: true
      })
    ).toBe(true)
  })

  it('returns false for paid course with session but no paid subscription', () => {
    expect(
      isLessonTerminalInteractive({
        overviewType: 'courses',
        hasUserSession: true,
        learnableIsFree: false,
        hasPaidSubscription: false
      })
    ).toBe(false)
  })

  it('returns true for modules in free path without paid subscription', () => {
    expect(
      isLessonTerminalInteractive({
        overviewType: 'modules',
        hasUserSession: true,
        learnableIsFree: true,
        hasPaidSubscription: false
      })
    ).toBe(true)
  })

  it('returns false for paid course without session', () => {
    expect(
      isLessonTerminalInteractive({
        overviewType: 'courses',
        hasUserSession: false,
        learnableIsFree: false,
        hasPaidSubscription: false
      })
    ).toBe(false)
  })

  it('returns false for paid modules without paid subscription', () => {
    expect(
      isLessonTerminalInteractive({
        overviewType: 'modules',
        hasUserSession: true,
        learnableIsFree: false,
        hasPaidSubscription: false
      })
    ).toBe(false)
  })

  it('returns true for modules with paid subscription', () => {
    expect(
      isLessonTerminalInteractive({
        overviewType: 'modules',
        hasUserSession: true,
        learnableIsFree: false,
        hasPaidSubscription: true
      })
    ).toBe(true)
  })
})

describe('getFirstNonPlaceholderLessonIdFromSections', () => {
  it('returns first non-placeholder lesson id', () => {
    const id = getFirstNonPlaceholderLessonIdFromSections([
      {
        modules: [
          {
            lessons: [
              { id: 'p1', isPlaceholder: true },
              { id: 'a', isPlaceholder: false }
            ]
          }
        ]
      }
    ])
    expect(id).toBe('a')
  })

  it('returns null when only placeholders', () => {
    const id = getFirstNonPlaceholderLessonIdFromSections([
      {
        modules: [{ lessons: [{ id: 'p1', isPlaceholder: true }] }]
      }
    ])
    expect(id).toBeNull()
  })
})
