import { describe, expect, it } from 'vitest'
import { createClearHandler } from '../../../../../src/core/shell/commands/handlers/system/clear'
import { createDebugHandler } from '../../../../../src/core/shell/commands/handlers/system/debug'
import { createHelpHandler } from '../../../../../src/core/shell/commands/handlers/system/help'

describe('System Handlers', () => {
  describe('clear', () => {
    it('should return empty output', () => {
      const handler = createClearHandler()
      const result = handler.execute([], {})

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe('')
      }
    })
  })

  describe('help', () => {
    it('should return help text', () => {
      const handler = createHelpHandler()
      const result = handler.execute([], {})

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('Available shell commands')
        expect(result.value).toContain('cd')
        expect(result.value).toContain('ls')
        expect(result.value).toContain('kubectl')
      }
    })
  })

  describe('debug', () => {
    it('should show usage when no subcommand', () => {
      const handler = createDebugHandler()
      const result = handler.execute([], {})

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('Debug commands')
        expect(result.value).toContain('debug logs')
        expect(result.value).toContain('debug clear')
      }
    })

    it('should handle logs subcommand', () => {
      const handler = createDebugHandler()
      const result = handler.execute(['logs'], {})

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('not available yet')
      }
    })

    it('should handle clear subcommand', () => {
      const handler = createDebugHandler()
      const result = handler.execute(['clear'], {})

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('cleared')
      }
    })

    it('should return error for unknown subcommand', () => {
      const handler = createDebugHandler()
      const result = handler.execute(['unknown'], {})

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('Unknown debug subcommand')
      }
    })
  })
})
