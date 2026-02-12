import { beforeEach, describe, expect, it } from 'vitest'
import { ShellAutocompleteProvider } from '../../../../src/core/shell/autocomplete/ShellAutocompleteProvider'
import type { AutocompleteContext } from '../../../../src/core/terminal/autocomplete/types'

describe('ShellAutocompleteProvider', () => {
  let provider: ShellAutocompleteProvider
  let mockContext: AutocompleteContext

  beforeEach(() => {
    provider = new ShellAutocompleteProvider()
    mockContext = {
      clusterState: {},
      fileSystem: {
        getCurrentPath: () => '/home/kube'
      }
    }
  })

  describe('priority', () => {
    it('should return 10', () => {
      expect(provider.priority()).toBe(10)
    })
  })

  describe('match', () => {
    it('should match when tokens.length === 0', () => {
      expect(provider.match([], '', '')).toBe(true)
    })

    it('should match when tokens.length === 1 and line does not end with space', () => {
      expect(provider.match(['kubectl'], 'kubectl', 'kubectl')).toBe(true)
      expect(provider.match(['cd'], 'cd', 'cd')).toBe(true)
      expect(provider.match(['ls'], 'ls', 'ls')).toBe(true)
    })

    it('should not match when tokens.length === 1 and line ends with space', () => {
      expect(provider.match(['kubectl'], '', 'kubectl ')).toBe(false)
      expect(provider.match(['cd'], '', 'cd ')).toBe(false)
    })

    it('should not match when tokens.length > 1', () => {
      expect(provider.match(['kubectl', 'get'], 'get', 'kubectl get')).toBe(
        false
      )
      expect(provider.match(['cd', '..'], '..', 'cd ..')).toBe(false)
    })
  })

  describe('complete', () => {
    it('should return all commands when token is empty', () => {
      const results = provider.complete([], '', mockContext)
      expect(results).toContainEqual({ text: 'kubectl', suffix: ' ' })
      expect(results).toContainEqual({ text: 'cd', suffix: ' ' })
      expect(results).toContainEqual({ text: 'ls', suffix: ' ' })
      expect(results).toContainEqual({ text: 'pwd', suffix: ' ' })
      expect(results).toContainEqual({ text: 'cat', suffix: ' ' })
      expect(results).toContainEqual({ text: 'clear', suffix: ' ' })
      expect(results).toContainEqual({ text: 'nano', suffix: ' ' })
    })

    it('should return kubectl when token is k', () => {
      const results = provider.complete([], 'k', mockContext)
      expect(results).toEqual([{ text: 'kubectl', suffix: ' ' }])
    })

    it('should return cd, cat, clear when token is c', () => {
      const results = provider.complete([], 'c', mockContext)
      expect(results).toContainEqual({ text: 'cd', suffix: ' ' })
      expect(results).toContainEqual({ text: 'cat', suffix: ' ' })
      expect(results).toContainEqual({ text: 'clear', suffix: ' ' })
      expect(results.length).toBe(3)
    })

    it('should return ls when token is l', () => {
      const results = provider.complete([], 'l', mockContext)
      expect(results).toEqual([{ text: 'ls', suffix: ' ' }])
    })

    it('should return empty array for unknown prefix', () => {
      const results = provider.complete([], 'xyz', mockContext)
      expect(results).toEqual([])
    })

    it('should filter commands case-sensitively', () => {
      const results = provider.complete([], 'K', mockContext)
      expect(results).toEqual([])
    })

    it('should return all commands starting with prefix', () => {
      const results = provider.complete([], 'n', mockContext)
      expect(results).toContainEqual({ text: 'nano', suffix: ' ' })
      expect(results.length).toBe(1)
    })

    it('should return vi and vim when token is v', () => {
      const results = provider.complete([], 'v', mockContext)
      expect(results).toContainEqual({ text: 'vi', suffix: ' ' })
      expect(results).toContainEqual({ text: 'vim', suffix: ' ' })
      expect(results.length).toBe(2)
    })
  })

  describe('edge cases / error scenarios', () => {
    describe('match() edge cases', () => {
      it('should handle tokens with special characters', () => {
        expect(provider.match(['kubectl!'], 'kubectl!', 'kubectl!')).toBe(true)
      })

      it('should handle line with tabs instead of spaces', () => {
        // Tabs should be treated as part of the token, not as separators
        expect(
          provider.match(['kubectl\tget'], 'kubectl\tget', 'kubectl\tget')
        ).toBe(true)
      })

      it('should handle empty line with tokens.length === 0', () => {
        expect(provider.match([], '', '')).toBe(true)
      })
    })

    describe('complete() edge cases', () => {
      it('should list ALL shell commands', () => {
        const results = provider.complete([], '', mockContext)
        const commandTexts = results.map((r) => r.text)

        // All shell commands from SHELL_COMMANDS + kubectl
        expect(commandTexts).toContain('kubectl')
        expect(commandTexts).toContain('cd')
        expect(commandTexts).toContain('ls')
        expect(commandTexts).toContain('pwd')
        expect(commandTexts).toContain('mkdir')
        expect(commandTexts).toContain('touch')
        expect(commandTexts).toContain('cat')
        expect(commandTexts).toContain('rm')
        expect(commandTexts).toContain('clear')
        expect(commandTexts).toContain('help')
        expect(commandTexts).toContain('debug')
        expect(commandTexts).toContain('nano')
        expect(commandTexts).toContain('vi')
        expect(commandTexts).toContain('vim')

        // Should have exactly 14 commands (13 shell + 1 kubectl)
        expect(commandTexts.length).toBe(14)
      })

      it('should handle commands with complex partial prefixes', () => {
        const results = provider.complete([], 'cl', mockContext)
        expect(results).toContainEqual({ text: 'clear', suffix: ' ' })
        expect(results.length).toBe(1)
      })

      it('should handle token with Unicode characters', () => {
        const results = provider.complete([], 'k', mockContext)
        // Should still match 'kubectl' even if token has Unicode
        expect(results).toEqual([{ text: 'kubectl', suffix: ' ' }])
      })

      it('should handle empty token with all commands', () => {
        const results = provider.complete([], '', mockContext)
        expect(results.length).toBeGreaterThan(0)
        expect(results.every((r) => r.suffix === ' ')).toBe(true)
      })
    })
  })
})
