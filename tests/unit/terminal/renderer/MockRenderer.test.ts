import { beforeEach, describe, expect, it } from 'vitest'
import { createMockRenderer } from '../../helpers/mockRenderer'

describe('MockRenderer', () => {
  let renderer: ReturnType<typeof createMockRenderer>

  beforeEach(() => {
    renderer = createMockRenderer()
  })

  it('captures writes and clearLine markers', () => {
    renderer.write('Hello')
    renderer.clearLine()
    renderer.write('World')

    expect(renderer.getOutput()).toBe('Hello[CLEAR_LINE]World')
    expect(renderer.getCallCount()).toBe(3)
  })

  it('clears output and call count', () => {
    renderer.write('Hello')
    renderer.clearLine()
    expect(renderer.getCallCount()).toBe(2)

    renderer.clearOutput()

    expect(renderer.getOutput()).toBe('')
    expect(renderer.getCallCount()).toBe(0)
  })

  it('focus and dispose are no-op', () => {
    expect(() => renderer.focus()).not.toThrow()
    expect(() => renderer.dispose()).not.toThrow()
  })
})
