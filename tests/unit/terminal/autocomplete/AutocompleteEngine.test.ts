import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AutocompleteEngine } from '../../../../src/core/terminal/autocomplete/AutocompleteEngine'
import { createAutocompleteTestContext } from '../../helpers/mockFileSystem'
import { AutocompleteProvider } from '../../../../src/core/terminal/autocomplete/AutocompleteProvider'
import type {
  AutocompleteContext,
  CompletionResult,
  TabCompletionCallbacks
} from '../../../../src/core/terminal/autocomplete/types'

// Mock provider pour les tests
class MockProvider extends AutocompleteProvider {
  constructor(
    private priorityValue: number,
    private shouldMatch: boolean,
    private completions: CompletionResult[]
  ) {
    super()
  }

  priority(): number {
    return this.priorityValue
  }

  match(_tokens: string[], _currentToken: string, _line: string): boolean {
    return this.shouldMatch
  }

  complete(
    _tokens: string[],
    _currentToken: string,
    _context: AutocompleteContext
  ): CompletionResult[] {
    return this.completions
  }
}

describe('AutocompleteEngine', () => {
  let engine: AutocompleteEngine
  let mockContext: AutocompleteContext

  beforeEach(() => {
    engine = new AutocompleteEngine()
    mockContext = createAutocompleteTestContext()
  })

  describe('registerProvider', () => {
    it('should register a provider', () => {
      const provider = new MockProvider(10, false, [])
      engine.registerProvider(provider)

      const results = engine.getCompletionResults('test', mockContext)
      expect(results).toEqual([])
    })

    it('should sort providers by priority', () => {
      const provider1 = new MockProvider(30, true, [
        { text: 'first', suffix: ' ' }
      ])
      const provider2 = new MockProvider(10, true, [
        { text: 'second', suffix: ' ' }
      ])
      const provider3 = new MockProvider(20, true, [
        { text: 'third', suffix: ' ' }
      ])

      // Register in non-priority order
      engine.registerProvider(provider1)
      engine.registerProvider(provider2)
      engine.registerProvider(provider3)

      // Provider with priority 10 should match first
      const results = engine.getCompletionResults('test', mockContext)
      expect(results).toEqual([{ text: 'second', suffix: ' ' }])
    })

    it('should re-sort when adding new provider', () => {
      const provider1 = new MockProvider(30, true, [
        { text: 'first', suffix: ' ' }
      ])
      const provider2 = new MockProvider(10, true, [
        { text: 'second', suffix: ' ' }
      ])

      engine.registerProvider(provider1)
      const results1 = engine.getCompletionResults('test', mockContext)
      expect(results1).toEqual([{ text: 'first', suffix: ' ' }])

      engine.registerProvider(provider2)
      const results2 = engine.getCompletionResults('test', mockContext)
      expect(results2).toEqual([{ text: 'second', suffix: ' ' }])
    })
  })

  describe('registerProviders', () => {
    it('should register multiple providers', () => {
      const provider1 = new MockProvider(10, true, [
        { text: 'first', suffix: ' ' }
      ])
      const provider2 = new MockProvider(20, false, [])
      const provider3 = new MockProvider(30, false, [])

      engine.registerProviders([provider1, provider2, provider3])

      const results = engine.getCompletionResults('test', mockContext)
      expect(results).toEqual([{ text: 'first', suffix: ' ' }])
    })

    it('should sort providers by priority when registering multiple', () => {
      const provider1 = new MockProvider(30, true, [
        { text: 'third', suffix: ' ' }
      ])
      const provider2 = new MockProvider(10, true, [
        { text: 'first', suffix: ' ' }
      ])
      const provider3 = new MockProvider(20, true, [
        { text: 'second', suffix: ' ' }
      ])

      engine.registerProviders([provider1, provider2, provider3])

      const results = engine.getCompletionResults('test', mockContext)
      expect(results).toEqual([{ text: 'first', suffix: ' ' }])
    })
  })

  describe('getCompletionResults', () => {
    it('should return empty array when no providers match', () => {
      const provider = new MockProvider(10, false, [])
      engine.registerProvider(provider)

      const results = engine.getCompletionResults('test', mockContext)
      expect(results).toEqual([])
    })

    it('should return empty array when no providers registered', () => {
      const results = engine.getCompletionResults('test', mockContext)
      expect(results).toEqual([])
    })

    it('should return completions from matching provider', () => {
      const completions: CompletionResult[] = [
        { text: 'kubectl', suffix: ' ' },
        { text: 'cd', suffix: ' ' }
      ]
      const provider = new MockProvider(10, true, completions)
      engine.registerProvider(provider)

      const results = engine.getCompletionResults('test', mockContext)
      expect(results).toEqual(completions)
    })

    it('should use first matching provider', () => {
      const provider1 = new MockProvider(10, true, [
        { text: 'first', suffix: ' ' }
      ])
      const provider2 = new MockProvider(20, true, [
        { text: 'second', suffix: ' ' }
      ])
      engine.registerProvider(provider1)
      engine.registerProvider(provider2)

      const results = engine.getCompletionResults('test', mockContext)
      expect(results).toEqual([{ text: 'first', suffix: ' ' }])
    })

    it('should tokenize input correctly', () => {
      const provider = new MockProvider(10, true, [
        { text: 'result', suffix: ' ' }
      ])
      engine.registerProvider(provider)

      // Test with multiple spaces
      const results1 = engine.getCompletionResults(
        'kubectl  get  pods',
        mockContext
      )
      expect(results1).toEqual([{ text: 'result', suffix: ' ' }])

      // Test with leading/trailing spaces
      const results2 = engine.getCompletionResults(
        '  kubectl get  ',
        mockContext
      )
      expect(results2).toEqual([{ text: 'result', suffix: ' ' }])
    })
  })

  describe('getCompletions', () => {
    it('should extract text from CompletionResult array', () => {
      const completions: CompletionResult[] = [
        { text: 'kubectl', suffix: ' ' },
        { text: 'cd', suffix: ' ' },
        { text: 'ls', suffix: ' ' }
      ]
      const provider = new MockProvider(10, true, completions)
      engine.registerProvider(provider)

      const results = engine.getCompletions('test', mockContext)
      expect(results).toEqual(['kubectl', 'cd', 'ls'])
    })

    it('should return empty array when no completions', () => {
      const provider = new MockProvider(10, true, [])
      engine.registerProvider(provider)

      const results = engine.getCompletions('test', mockContext)
      expect(results).toEqual([])
    })
  })

  describe('getCommonPrefix', () => {
    it('should return empty string for empty array', () => {
      const prefix = engine.getCommonPrefix([])
      expect(prefix).toBe('')
    })

    it('should return the single item if array has one element', () => {
      const prefix = engine.getCommonPrefix(['kubectl'])
      expect(prefix).toBe('kubectl')
    })

    it('should return common prefix for multiple items', () => {
      const prefix = engine.getCommonPrefix(['kubectl', 'kube'])
      expect(prefix).toBe('kube')
    })

    it('should return longest common prefix', () => {
      const prefix = engine.getCommonPrefix(['nginx-1', 'nginx-2', 'nginx-3'])
      expect(prefix).toBe('nginx-')
    })

    it('should return empty string if no common prefix', () => {
      const prefix = engine.getCommonPrefix(['kubectl', 'cd', 'ls'])
      expect(prefix).toBe('')
    })

    it('should handle partial matches correctly', () => {
      const prefix = engine.getCommonPrefix(['pods', 'pod'])
      expect(prefix).toBe('pod')
    })

    it('should handle unsorted array', () => {
      const prefix = engine.getCommonPrefix(['zebra', 'alpha', 'beta'])
      expect(prefix).toBe('')
    })

    it('should handle case-sensitive comparison', () => {
      const prefix = engine.getCommonPrefix(['Kubectl', 'kubectl'])
      expect(prefix).toBe('')
    })
  })

  describe('formatSuggestions', () => {
    it('should return empty string for empty array', () => {
      const formatted = engine.formatSuggestions([])
      expect(formatted).toBe('')
    })

    it('should return single item as-is', () => {
      const formatted = engine.formatSuggestions(['kubectl'])
      expect(formatted).toBe('kubectl')
    })

    it('should format multiple suggestions in columns', () => {
      const formatted = engine.formatSuggestions(['kubectl', 'cd', 'ls', 'pwd'])
      expect(formatted).toContain('kubectl')
      expect(formatted).toContain('cd')
      expect(formatted).toContain('ls')
      expect(formatted).toContain('pwd')
      // With 4 items, they all fit on one row, so no \r\n
      expect(formatted).not.toContain('\r\n')
    })

    it('should format suggestions with multiple rows when more than 4 items', () => {
      const formatted = engine.formatSuggestions(['a', 'b', 'c', 'd', 'e', 'f'])
      expect(formatted).toContain('\r\n')
      expect(formatted).toContain('a')
      expect(formatted).toContain('e')
    })

    it('should pad items to 20 characters', () => {
      const formatted = engine.formatSuggestions(['a', 'b'])
      const lines = formatted.split('\r\n')
      expect(lines[0].length).toBeGreaterThanOrEqual(40) // 2 items * 20 chars
    })

    it('should handle more than 4 items per row', () => {
      const formatted = engine.formatSuggestions(['a', 'b', 'c', 'd', 'e', 'f'])
      const lines = formatted.split('\r\n')
      expect(lines.length).toBe(2) // 4 items first row, 2 items second row
    })
  })

  describe('handleTabPress', () => {
    let mockCallbacks: TabCompletionCallbacks

    beforeEach(() => {
      mockCallbacks = {
        write: vi.fn(),
        showPrompt: vi.fn(),
        updateLineAndRender: vi.fn(),
        getCurrentToken: vi.fn(() => ''),
        getCurrentLine: vi.fn(() => ''),
        updateCurrentLine: vi.fn()
      }
    })

    it('should do nothing when no completion results', () => {
      const provider = new MockProvider(10, true, [])
      engine.registerProvider(provider)

      engine.handleTabPress('test', mockContext, mockCallbacks)

      expect(mockCallbacks.write).not.toHaveBeenCalled()
      expect(mockCallbacks.updateLineAndRender).not.toHaveBeenCalled()
    })

    it('should complete single match', () => {
      const provider = new MockProvider(10, true, [
        { text: 'kubectl', suffix: ' ' }
      ])
      engine.registerProvider(provider)

      vi.mocked(mockCallbacks.getCurrentToken).mockReturnValue('kube')
      vi.mocked(mockCallbacks.getCurrentLine).mockReturnValue('kube')

      engine.handleTabPress('kube', mockContext, mockCallbacks)

      expect(mockCallbacks.updateLineAndRender).toHaveBeenCalledWith(
        'kubectl ',
        'ctl '
      )
    })

    it('should append suffix when token is already complete', () => {
      const provider = new MockProvider(10, true, [
        { text: 'kubectl', suffix: ' ' }
      ])
      engine.registerProvider(provider)

      vi.mocked(mockCallbacks.getCurrentToken).mockReturnValue('kubectl')
      vi.mocked(mockCallbacks.getCurrentLine).mockReturnValue('kubectl')

      engine.handleTabPress('kubectl', mockContext, mockCallbacks)

      expect(mockCallbacks.updateLineAndRender).toHaveBeenCalledWith(
        'kubectl ',
        ' '
      )
    })

    it('should not append suffix if already present', () => {
      const provider = new MockProvider(10, true, [
        { text: 'kubectl', suffix: ' ' }
      ])
      engine.registerProvider(provider)

      vi.mocked(mockCallbacks.getCurrentToken).mockReturnValue('kubectl')
      vi.mocked(mockCallbacks.getCurrentLine).mockReturnValue('kubectl ')

      engine.handleTabPress('kubectl ', mockContext, mockCallbacks)

      expect(mockCallbacks.updateLineAndRender).not.toHaveBeenCalled()
    })

    it('should complete common prefix on single tab with multiple matches', () => {
      const provider = new MockProvider(10, true, [
        { text: 'kubectl-get', suffix: ' ' },
        { text: 'kubectl-describe', suffix: ' ' }
      ])
      engine.registerProvider(provider)

      vi.mocked(mockCallbacks.getCurrentToken).mockReturnValue('kubectl-')
      vi.mocked(mockCallbacks.getCurrentLine).mockReturnValue('kubectl-')

      engine.handleTabPress('kubectl-', mockContext, mockCallbacks)

      // Common prefix is 'kubectl-', so no additional text to add
      expect(mockCallbacks.updateLineAndRender).not.toHaveBeenCalled()
    })

    it('should show all suggestions on double tab (<500ms)', () => {
      const provider = new MockProvider(10, true, [
        { text: 'pod1', suffix: ' ' },
        { text: 'pod2', suffix: ' ' },
        { text: 'pod3', suffix: ' ' }
      ])
      engine.registerProvider(provider)

      vi.mocked(mockCallbacks.getCurrentToken).mockReturnValue('pod')
      vi.mocked(mockCallbacks.getCurrentLine).mockReturnValue('pod')

      // First tab
      engine.handleTabPress('pod', mockContext, mockCallbacks)

      // Second tab within 500ms (simulate by not waiting)
      engine.handleTabPress('pod', mockContext, mockCallbacks)

      expect(mockCallbacks.write).toHaveBeenCalledWith('\r\n')
      expect(mockCallbacks.write).toHaveBeenCalledWith(
        expect.stringContaining('pod1')
      )
      expect(mockCallbacks.write).toHaveBeenCalledWith(
        expect.stringContaining('pod2')
      )
      expect(mockCallbacks.write).toHaveBeenCalledWith(
        expect.stringContaining('pod3')
      )
      expect(mockCallbacks.showPrompt).toHaveBeenCalled()
      expect(mockCallbacks.updateCurrentLine).toHaveBeenCalled()
    })

    it('should complete common prefix on single tab with multiple matches (>500ms)', async () => {
      vi.useFakeTimers()

      const provider = new MockProvider(10, true, [
        { text: 'nginx-1', suffix: ' ' },
        { text: 'nginx-2', suffix: ' ' }
      ])
      engine.registerProvider(provider)

      vi.mocked(mockCallbacks.getCurrentToken).mockReturnValue('ngin')
      vi.mocked(mockCallbacks.getCurrentLine).mockReturnValue('ngin')

      // First tab - this will set lastTabPress to current time (0 with fake timers)
      engine.handleTabPress('ngin', mockContext, mockCallbacks)

      // Advance time by 600ms (more than 500ms threshold)
      // This advances Date.now() as well, so the next handleTabPress will see 600ms difference
      vi.advanceTimersByTime(600)

      // Second tab after delay
      engine.handleTabPress('ngin', mockContext, mockCallbacks)

      // Should complete common prefix 'nginx-' instead of showing suggestions
      expect(mockCallbacks.updateLineAndRender).toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('should handle common prefix when no additional characters to add', () => {
      const provider = new MockProvider(10, true, [
        { text: 'pod', suffix: ' ' },
        { text: 'pod2', suffix: ' ' }
      ])
      engine.registerProvider(provider)

      vi.mocked(mockCallbacks.getCurrentToken).mockReturnValue('pod')
      vi.mocked(mockCallbacks.getCurrentLine).mockReturnValue('pod')

      engine.handleTabPress('pod', mockContext, mockCallbacks)

      // Common prefix is 'pod', current token is 'pod', so nothing to add
      expect(mockCallbacks.updateLineAndRender).not.toHaveBeenCalled()
    })

    it('should call all callbacks correctly in double tab scenario', () => {
      const provider = new MockProvider(10, true, [
        { text: 'test1', suffix: ' ' },
        { text: 'test2', suffix: ' ' }
      ])
      engine.registerProvider(provider)

      vi.mocked(mockCallbacks.getCurrentToken).mockReturnValue('test')
      vi.mocked(mockCallbacks.getCurrentLine).mockReturnValue('test')

      // First tab
      engine.handleTabPress('test', mockContext, mockCallbacks)
      // Second tab immediately
      engine.handleTabPress('test', mockContext, mockCallbacks)

      expect(mockCallbacks.write).toHaveBeenCalledWith('\r\n')
      expect(mockCallbacks.write).toHaveBeenCalledWith(expect.any(String))
      expect(mockCallbacks.write).toHaveBeenCalledWith('\r\n')
      expect(mockCallbacks.showPrompt).toHaveBeenCalled()
      expect(mockCallbacks.write).toHaveBeenCalledWith('test')
      expect(mockCallbacks.updateCurrentLine).toHaveBeenCalledWith('test', 4)
    })
  })

  describe('edge cases / error scenarios', () => {
    describe('tokenize edge cases', () => {
      it('should handle line with only spaces', () => {
        const provider = new MockProvider(10, true, [
          { text: 'result', suffix: ' ' }
        ])
        engine.registerProvider(provider)

        const results = engine.getCompletionResults('   ', mockContext)
        // tokenize('   ') returns [] (empty after trim and filter)
        // So tokens = [], currentToken = ''
        // Provider.match([], '', '   ') is called
        // If provider matches, it returns results, otherwise []
        // Since MockProvider.match returns true, we get results
        // But in real scenario, providers should check tokens.length
        expect(results).toEqual([{ text: 'result', suffix: ' ' }])
      })

      it('should handle line with tabs mixed with spaces', () => {
        const provider = new MockProvider(10, true, [
          { text: 'result', suffix: ' ' }
        ])
        engine.registerProvider(provider)

        const results = engine.getCompletionResults(
          'kubectl\tget\tpods',
          mockContext
        )
        // Tabs should be treated as whitespace
        expect(results).toEqual([{ text: 'result', suffix: ' ' }])
      })

      it('should handle line with multiple consecutive spaces (3+)', () => {
        const provider = new MockProvider(10, true, [
          { text: 'result', suffix: ' ' }
        ])
        engine.registerProvider(provider)

        const results = engine.getCompletionResults(
          'kubectl   get     pods',
          mockContext
        )
        expect(results).toEqual([{ text: 'result', suffix: ' ' }])
      })

      it('should handle empty line', () => {
        const provider = new MockProvider(10, true, [
          { text: 'result', suffix: ' ' }
        ])
        engine.registerProvider(provider)

        const results = engine.getCompletionResults('', mockContext)
        // tokenize('') returns [] (empty after trim and filter)
        // So tokens = [], currentToken = ''
        // Provider.match([], '', '') is called
        // Since MockProvider.match returns true, we get results
        // But in real scenario, providers should check tokens.length
        expect(results).toEqual([{ text: 'result', suffix: ' ' }])
      })

      it('should handle line with Unicode characters', () => {
        const provider = new MockProvider(10, true, [
          { text: 'result', suffix: ' ' }
        ])
        engine.registerProvider(provider)

        const results = engine.getCompletionResults(
          'kubectl 🚀 get',
          mockContext
        )
        expect(results).toEqual([{ text: 'result', suffix: ' ' }])
      })

      it('should handle line with special characters in tokens', () => {
        const provider = new MockProvider(10, true, [
          { text: 'result', suffix: ' ' }
        ])
        engine.registerProvider(provider)

        const results = engine.getCompletionResults(
          'kubectl get-pods',
          mockContext
        )
        expect(results).toEqual([{ text: 'result', suffix: ' ' }])
      })
    })

    describe('getCurrentToken edge cases', () => {
      it('should handle line with only spaces', () => {
        const provider = new MockProvider(10, true, [
          { text: 'result', suffix: ' ' }
        ])
        engine.registerProvider(provider)

        const results = engine.getCompletionResults('   ', mockContext)
        // getCurrentToken('   ') returns '' (line ends with space)
        // But provider still matches and returns results
        expect(results).toEqual([{ text: 'result', suffix: ' ' }])
      })

      it('should handle line ending with space (empty token)', () => {
        const provider = new MockProvider(10, true, [
          { text: 'result', suffix: ' ' }
        ])
        engine.registerProvider(provider)

        const results = engine.getCompletionResults('kubectl ', mockContext)
        // Current token should be empty string
        expect(results).toEqual([{ text: 'result', suffix: ' ' }])
      })

      it('should handle line with single character', () => {
        const provider = new MockProvider(10, true, [
          { text: 'result', suffix: ' ' }
        ])
        engine.registerProvider(provider)

        const results = engine.getCompletionResults('k', mockContext)
        expect(results).toEqual([{ text: 'result', suffix: ' ' }])
      })

      it('should handle line with Unicode in token', () => {
        const provider = new MockProvider(10, true, [
          { text: 'result', suffix: ' ' }
        ])
        engine.registerProvider(provider)

        const results = engine.getCompletionResults('kubectl 🚀', mockContext)
        expect(results).toEqual([{ text: 'result', suffix: ' ' }])
      })
    })

    describe('getCommonPrefix edge cases', () => {
      it('should handle single character common prefix', () => {
        const prefix = engine.getCommonPrefix(['abc', 'ade', 'afg'])
        expect(prefix).toBe('a')
      })

      it('should handle prefix with special characters', () => {
        const prefix = engine.getCommonPrefix(['test-1', 'test-2', 'test-3'])
        expect(prefix).toBe('test-')
      })

      it('should handle prefix with Unicode characters', () => {
        const prefix = engine.getCommonPrefix(['café', 'café-au-lait'])
        expect(prefix).toBe('café')
      })

      it('should handle very long prefix (>100 chars)', () => {
        const longPrefix = 'a'.repeat(100)
        const prefix = engine.getCommonPrefix([
          longPrefix + '1',
          longPrefix + '2',
          longPrefix + '3'
        ])
        expect(prefix).toBe(longPrefix)
      })

      it('should handle array with duplicates', () => {
        const prefix = engine.getCommonPrefix(['test', 'test', 'test'])
        expect(prefix).toBe('test')
      })

      it('should handle array with empty strings', () => {
        const prefix = engine.getCommonPrefix(['', 'abc', 'def'])
        expect(prefix).toBe('')
      })
    })

    describe('formatSuggestions edge cases', () => {
      it('should handle items longer than 20 characters', () => {
        const longItem = 'a'.repeat(30)
        const formatted = engine.formatSuggestions([longItem, 'short'])
        expect(formatted).toContain(longItem)
        expect(formatted).toContain('short')
      })

      it('should handle items with special characters', () => {
        const formatted = engine.formatSuggestions([
          'test-1',
          'test_2',
          'test.3'
        ])
        expect(formatted).toContain('test-1')
        expect(formatted).toContain('test_2')
        expect(formatted).toContain('test.3')
      })

      it('should handle items with Unicode characters', () => {
        const formatted = engine.formatSuggestions(['café', 'naïve', 'résumé'])
        expect(formatted).toContain('café')
        expect(formatted).toContain('naïve')
        expect(formatted).toContain('résumé')
      })

      it('should handle exactly 4 items (border case)', () => {
        const formatted = engine.formatSuggestions(['a', 'b', 'c', 'd'])
        const lines = formatted.split('\r\n')
        expect(lines.length).toBe(1) // All on one line
        expect(formatted).toContain('a')
        expect(formatted).toContain('d')
      })

      it('should handle exactly 8 items (2 complete rows)', () => {
        const formatted = engine.formatSuggestions([
          'a',
          'b',
          'c',
          'd',
          'e',
          'f',
          'g',
          'h'
        ])
        const lines = formatted.split('\r\n')
        expect(lines.length).toBe(2)
      })

      it('should handle 9 items (2 rows + 1 item)', () => {
        const formatted = engine.formatSuggestions([
          'a',
          'b',
          'c',
          'd',
          'e',
          'f',
          'g',
          'h',
          'i'
        ])
        const lines = formatted.split('\r\n')
        expect(lines.length).toBe(3) // 2 full rows + 1 partial
      })
    })

    describe('handleTabPress edge cases', () => {
      let mockCallbacks: TabCompletionCallbacks

      beforeEach(() => {
        mockCallbacks = {
          write: vi.fn(),
          showPrompt: vi.fn(),
          updateLineAndRender: vi.fn(),
          getCurrentToken: vi.fn(() => ''),
          getCurrentLine: vi.fn(() => ''),
          updateCurrentLine: vi.fn()
        }
      })

      it('should handle callback that throws error', () => {
        const provider = new MockProvider(10, true, [
          { text: 'kubectl', suffix: ' ' }
        ])
        engine.registerProvider(provider)

        vi.mocked(mockCallbacks.getCurrentToken).mockReturnValue('kube')
        vi.mocked(mockCallbacks.getCurrentLine).mockReturnValue('kube')
        vi.mocked(mockCallbacks.updateLineAndRender).mockImplementation(() => {
          throw new Error('Callback error')
        })

        // Should throw or handle gracefully
        expect(() => {
          engine.handleTabPress('kube', mockContext, mockCallbacks)
        }).toThrow('Callback error')
      })

      it('should handle timing exactly at 500ms border', async () => {
        vi.useFakeTimers()

        const provider = new MockProvider(10, true, [
          { text: 'pod1', suffix: ' ' },
          { text: 'pod2', suffix: ' ' }
        ])
        engine.registerProvider(provider)

        vi.mocked(mockCallbacks.getCurrentToken).mockReturnValue('pod')
        vi.mocked(mockCallbacks.getCurrentLine).mockReturnValue('pod')

        // First tab
        engine.handleTabPress('pod', mockContext, mockCallbacks)

        // Advance time by exactly 500ms (border case)
        // At exactly 500ms, (now - lastTabPress) === 500, which is NOT < 500
        // So isDoubleTap = false, and we go to handleCommonPrefix
        vi.advanceTimersByTime(500)

        // Second tab at border
        engine.handleTabPress('pod', mockContext, mockCallbacks)

        // Common prefix is 'pod', currentToken is 'pod', so toAdd = '' (empty)
        // handleCommonPrefix returns early if toAdd is empty
        // So updateLineAndRender is NOT called
        expect(mockCallbacks.updateLineAndRender).not.toHaveBeenCalled()

        vi.useRealTimers()
      })

      it('should handle multiple rapid tabs (>2 tabs)', () => {
        const provider = new MockProvider(10, true, [
          { text: 'pod1', suffix: ' ' },
          { text: 'pod2', suffix: ' ' }
        ])
        engine.registerProvider(provider)

        vi.mocked(mockCallbacks.getCurrentToken).mockReturnValue('pod')
        vi.mocked(mockCallbacks.getCurrentLine).mockReturnValue('pod')

        // Three rapid tabs
        engine.handleTabPress('pod', mockContext, mockCallbacks)
        engine.handleTabPress('pod', mockContext, mockCallbacks)
        engine.handleTabPress('pod', mockContext, mockCallbacks)

        // Should show suggestions on second tab, then handle third appropriately
        expect(mockCallbacks.write).toHaveBeenCalled()
      })

      it('should handle currentToken longer than result.text', () => {
        const provider = new MockProvider(10, true, [
          { text: 'kubectl', suffix: ' ' }
        ])
        engine.registerProvider(provider)

        vi.mocked(mockCallbacks.getCurrentToken).mockReturnValue(
          'kubectl-extra'
        )
        vi.mocked(mockCallbacks.getCurrentLine).mockReturnValue('kubectl-extra')

        engine.handleTabPress('kubectl-extra', mockContext, mockCallbacks)

        // Single match: currentToken ('kubectl-extra') !== result.text ('kubectl')
        // So we call completePartialToken which does:
        // toAdd = result.text.slice(currentToken.length) + result.suffix
        // toAdd = 'kubectl'.slice(13) + ' ' = '' + ' ' = ' '
        // So updateLineAndRender IS called with the suffix
        expect(mockCallbacks.updateLineAndRender).toHaveBeenCalled()
      })

      it('should handle suffix empty string', () => {
        const provider = new MockProvider(10, true, [
          { text: 'kubectl', suffix: '' }
        ])
        engine.registerProvider(provider)

        vi.mocked(mockCallbacks.getCurrentToken).mockReturnValue('kube')
        vi.mocked(mockCallbacks.getCurrentLine).mockReturnValue('kube')

        engine.handleTabPress('kube', mockContext, mockCallbacks)

        expect(mockCallbacks.updateLineAndRender).toHaveBeenCalledWith(
          'kubectl',
          'ctl'
        )
      })
    })

    describe('multiple providers edge cases', () => {
      it('should use only first matching provider when multiple match', () => {
        const provider1 = new MockProvider(10, true, [
          { text: 'first', suffix: ' ' }
        ])
        const provider2 = new MockProvider(20, true, [
          { text: 'second', suffix: ' ' }
        ])
        const provider3 = new MockProvider(30, true, [
          { text: 'third', suffix: ' ' }
        ])

        engine.registerProvider(provider1)
        engine.registerProvider(provider2)
        engine.registerProvider(provider3)

        const results = engine.getCompletionResults('test', mockContext)
        // Only first provider should be used
        expect(results).toEqual([{ text: 'first', suffix: ' ' }])
      })

      it('should handle provider that matches but returns empty array', () => {
        const provider = new MockProvider(10, true, [])
        engine.registerProvider(provider)

        const results = engine.getCompletionResults('test', mockContext)
        expect(results).toEqual([])
      })

      it('should handle provider that throws in match()', () => {
        class ThrowingProvider extends AutocompleteProvider {
          priority() {
            return 10
          }
          match(
            _tokens: string[],
            _currentToken: string,
            _line: string
          ): boolean {
            throw new Error('Match error')
          }
          complete() {
            return []
          }
        }

        const provider = new ThrowingProvider()
        engine.registerProvider(provider)

        // Should propagate error
        expect(() => {
          engine.getCompletionResults('test', mockContext)
        }).toThrow('Match error')
      })

      it('should handle provider that throws in complete()', () => {
        class ThrowingProvider extends AutocompleteProvider {
          priority() {
            return 10
          }
          match(
            _tokens: string[],
            _currentToken: string,
            _line: string
          ): boolean {
            return true
          }
          complete(
            _tokens: string[],
            _currentToken: string,
            _context: AutocompleteContext
          ): CompletionResult[] {
            throw new Error('Complete error')
          }
        }

        const provider = new ThrowingProvider()
        engine.registerProvider(provider)

        // Should propagate error
        expect(() => {
          engine.getCompletionResults('test', mockContext)
        }).toThrow('Complete error')
      })
    })
  })
})
