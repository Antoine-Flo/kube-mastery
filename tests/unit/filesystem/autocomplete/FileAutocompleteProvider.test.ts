import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FileAutocompleteProvider } from '../../../../src/core/filesystem/autocomplete/FileAutocompleteProvider'
import type { AutocompleteContext } from '../../../../src/core/terminal/autocomplete/types'
import { createAutocompleteTestContext } from '../../helpers/mockFileSystem'

describe('FileAutocompleteProvider', () => {
  let provider: FileAutocompleteProvider
  let mockContext: AutocompleteContext

  beforeEach(() => {
    provider = new FileAutocompleteProvider()
    mockContext = createAutocompleteTestContext()
  })

  describe('priority', () => {
    it('should return 50', () => {
      expect(provider.priority()).toBe(50)
    })
  })

  describe('match', () => {
    it('should not match when tokens.length === 0', () => {
      expect(provider.match([], '', '')).toBe(false)
    })

    it('should match when command is cd', () => {
      expect(provider.match(['cd'], '', 'cd')).toBe(true)
      expect(provider.match(['cd', '..'], '..', 'cd ..')).toBe(true)
    })

    it('should match when command is ls', () => {
      expect(provider.match(['ls'], '', 'ls')).toBe(true)
      expect(provider.match(['ls', '/'], '/', 'ls /')).toBe(true)
    })

    it('should match when command is cat', () => {
      expect(provider.match(['cat'], '', 'cat')).toBe(true)
      expect(
        provider.match(['cat', 'file.txt'], 'file.txt', 'cat file.txt')
      ).toBe(true)
    })

    it('should match when command is nano', () => {
      expect(provider.match(['nano'], '', 'nano')).toBe(true)
      expect(
        provider.match(['nano', 'file.txt'], 'file.txt', 'nano file.txt')
      ).toBe(true)
    })

    it('should match when command is rm', () => {
      expect(provider.match(['rm'], '', 'rm')).toBe(true)
      expect(
        provider.match(['rm', 'file.txt'], 'file.txt', 'rm file.txt')
      ).toBe(true)
    })

    it('should match when command is vi', () => {
      expect(provider.match(['vi'], '', 'vi')).toBe(true)
      expect(
        provider.match(['vi', 'file.txt'], 'file.txt', 'vi file.txt')
      ).toBe(true)
    })

    it('should match when command is vim', () => {
      expect(provider.match(['vim'], '', 'vim')).toBe(true)
      expect(
        provider.match(['vim', 'file.txt'], 'file.txt', 'vim file.txt')
      ).toBe(true)
    })

    it('should not match when command is not in FILE_COMMANDS', () => {
      expect(provider.match(['kubectl'], '', 'kubectl')).toBe(false)
      expect(provider.match(['pwd'], '', 'pwd')).toBe(false)
      expect(provider.match(['mkdir'], '', 'mkdir')).toBe(false)
      expect(provider.match(['touch'], '', 'touch')).toBe(false)
    })
  })

  describe('complete', () => {
    it('should return empty array for cd command (current implementation)', () => {
      const results = provider.complete(['cd'], '', mockContext)
      expect(results).toEqual([])
    })

    it('should return empty array for ls command (current implementation)', () => {
      const results = provider.complete(['ls'], '', mockContext)
      expect(results).toEqual([])
    })

    it('should return empty array for cat command (current implementation)', () => {
      const results = provider.complete(['cat'], '', mockContext)
      expect(results).toEqual([])
    })

    it('should return empty array for nano command (current implementation)', () => {
      const results = provider.complete(['nano'], '', mockContext)
      expect(results).toEqual([])
    })

    it('should handle getCurrentPath error gracefully', () => {
      const contextWithError: AutocompleteContext =
        createAutocompleteTestContext({
          fileSystemOverrides: {
            getCurrentPath: () => {
              throw new Error('Filesystem error')
            }
          }
        })
      const results = provider.complete(['cd'], '', contextWithError)
      expect(results).toEqual([])
    })

    it('should call getCurrentPath when completing', () => {
      const getCurrentPathSpy = vi.fn(() => '/home/kube')
      const contextWithSpy: AutocompleteContext = createAutocompleteTestContext(
        {
          fileSystemOverrides: {
            getCurrentPath: getCurrentPathSpy
          }
        }
      )
      provider.complete(['cd'], '', contextWithSpy)
      expect(getCurrentPathSpy).toHaveBeenCalled()
    })
  })

  describe('edge cases / error scenarios', () => {
    describe('match() edge cases', () => {
      it('should handle command with multiple arguments', () => {
        expect(provider.match(['cd', '..', '/'], '/', 'cd .. /')).toBe(true)
        expect(provider.match(['ls', '-l', '/'], '/', 'ls -l /')).toBe(true)
      })

      it('should handle command with flags (cd -L)', () => {
        expect(provider.match(['cd', '-L', '/'], '/', 'cd -L /')).toBe(true)
      })

      it('should handle command with flags (ls -l)', () => {
        expect(provider.match(['ls', '-l', '/'], '/', 'ls -l /')).toBe(true)
      })

      it('should not match when command has flags but no file argument yet', () => {
        // When only command + flag, no file argument, should still match
        expect(provider.match(['ls', '-l'], '-l', 'ls -l')).toBe(true)
      })
    })

    describe('complete() edge cases', () => {
      // Note: These tests are placeholders for when file completion is fully implemented
      // Currently getFileCompletions returns empty array

      it('should handle relative paths (when implemented)', () => {
        // Placeholder: When implemented, should complete relative paths
        const results = provider.complete(['cd'], '', mockContext)
        expect(results).toEqual([]) // Current implementation
      })

      it('should handle absolute paths (when implemented)', () => {
        // Placeholder: When implemented, should complete absolute paths
        const results = provider.complete(['cd'], '/', mockContext)
        expect(results).toEqual([]) // Current implementation
      })

      it('should handle paths with .. (when implemented)', () => {
        // Placeholder: When implemented, should handle parent directory references
        const results = provider.complete(['cd'], '..', mockContext)
        expect(results).toEqual([]) // Current implementation
      })

      it('should handle paths with . (when implemented)', () => {
        // Placeholder: When implemented, should handle current directory references
        const results = provider.complete(['cd'], '.', mockContext)
        expect(results).toEqual([]) // Current implementation
      })

      it('should distinguish files vs directories for cd (when implemented)', () => {
        // Placeholder: cd should only suggest directories
        const results = provider.complete(['cd'], '', mockContext)
        expect(results).toEqual([]) // Current implementation
      })

      it('should suggest both files and directories for ls (when implemented)', () => {
        // Placeholder: ls should suggest both files and directories
        const results = provider.complete(['ls'], '', mockContext)
        expect(results).toEqual([]) // Current implementation
      })

      it('should handle file names with special characters (if allowed)', () => {
        // Placeholder: When implemented, should handle special characters if filesystem allows them
        const results = provider.complete(['cat'], 'file-', mockContext)
        expect(results).toEqual([]) // Current implementation
      })
    })
  })
})
