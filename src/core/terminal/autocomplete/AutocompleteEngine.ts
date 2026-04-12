// ═══════════════════════════════════════════════════════════════════════════
// AUTOCOMPLETE ENGINE
// ═══════════════════════════════════════════════════════════════════════════
// Moteur principal qui orchestre les providers d'autocomplete
// Utilise le pattern Strategy avec des providers pluggables

import { applyKubectlCliAliases } from '../../kubectl/cli/runtime/tokenize'

import { AutocompleteProvider } from './AutocompleteProvider'
import type {
  AutocompleteContext,
  CompletionResult,
  TabCompletionCallbacks
} from './types'

/**
 * Tokenize input by splitting on spaces (handles multiple spaces)
 */
const tokenize = (input: string): string[] => {
  return input
    .trim()
    .split(/\s+/)
    .filter((t) => t.length > 0)
}

/**
 * Get the current token being typed (last token, even if incomplete)
 */
const getCurrentToken = (input: string): string => {
  if (input.endsWith(' ')) {
    return ''
  }

  const lastSpace = input.lastIndexOf(' ')
  if (lastSpace === -1) {
    return input
  }

  return input.slice(lastSpace + 1)
}

/**
 * Alphabetical string comparison using localeCompare for reliable sorting
 */
const compareStrings = (a: string, b: string): number => {
  return a.localeCompare(b)
}

export class AutocompleteEngine {
  private providers: AutocompleteProvider[] = []
  private lastTabPress: number = 0

  /**
   * Enregistre un nouveau provider d'autocomplete
   */
  registerProvider(provider: AutocompleteProvider): void {
    this.providers.push(provider)
    // Trier par priorité (plus bas = en premier)
    this.providers.sort((a, b) => a.priority() - b.priority())
  }

  /**
   * Enregistre plusieurs providers d'un coup
   */
  registerProviders(providers: AutocompleteProvider[]): void {
    providers.forEach((provider) => this.registerProvider(provider))
  }

  /**
   * Get completion results with proper suffixes for directories vs files/commands
   */
  getCompletionResults(
    currentLine: string,
    context: AutocompleteContext
  ): CompletionResult[] {
    const tokens = tokenize(currentLine)
    applyKubectlCliAliases(tokens)
    const currentToken = getCurrentToken(currentLine)

    // Essayer chaque provider dans l'ordre de priorité
    for (const provider of this.providers) {
      if (provider.match(tokens, currentToken, currentLine)) {
        return provider.complete(tokens, currentToken, context)
      }
    }

    return []
  }

  /**
   * Get all completion suggestions for the current line
   * Returns matching strings based on context (commands, resources, files, etc.)
   */
  getCompletions(currentLine: string, context: AutocompleteContext): string[] {
    const results = this.getCompletionResults(currentLine, context)
    return results.map((result) => result.text)
  }

  /**
   * Find the longest common prefix among suggestions
   */
  getCommonPrefix(suggestions: string[]): string {
    if (suggestions.length === 0) {
      return ''
    }
    if (suggestions.length === 1) {
      return suggestions[0]
    }

    const sorted = suggestions.slice().sort(compareStrings)
    const first = sorted[0]
    const last = sorted[sorted.length - 1]
    let i = 0

    while (i < first.length && first[i] === last[i]) {
      i++
    }

    return first.slice(0, i)
  }

  /**
   * Format suggestions for display (bash-like column format)
   */
  formatSuggestions(suggestions: string[]): string {
    if (suggestions.length === 0) {
      return ''
    }
    if (suggestions.length === 1) {
      return suggestions[0]
    }

    // Simple column format - 4 items per row with padding
    const itemsPerRow = 4
    const rows: string[] = []

    for (let i = 0; i < suggestions.length; i += itemsPerRow) {
      const row = suggestions.slice(i, i + itemsPerRow)
      rows.push(row.map((item) => item.padEnd(20)).join(''))
    }

    return rows.join('\r\n')
  }

  /**
   * Gère l'appui sur Tab avec toute la logique de complétion
   * Inclut le timing du double tap, la décision single/double tap, et l'affichage
   */
  handleTabPress(
    line: string,
    context: AutocompleteContext,
    callbacks: TabCompletionCallbacks
  ): void {
    const completionResults = this.getCompletionResults(line, context)

    if (completionResults.length === 0) {
      return
    }

    const now = Date.now()
    const isDoubleTap = now - this.lastTabPress < 500
    this.lastTabPress = now

    if (completionResults.length === 1) {
      this.handleSingleMatch(completionResults[0], callbacks)
      return
    }

    if (isDoubleTap) {
      this.handleDoubleTab(completionResults, callbacks)
      return
    }

    this.handleCommonPrefix(completionResults, callbacks)
  }

  private handleSingleMatch(
    result: CompletionResult,
    callbacks: TabCompletionCallbacks
  ): void {
    const currentToken = callbacks.getCurrentToken()

    if (currentToken === result.text) {
      this.appendSuffixIfMissing(result.suffix, callbacks)
      return
    }

    this.completePartialToken(currentToken, result, callbacks)
  }

  private appendSuffixIfMissing(
    suffix: string,
    callbacks: TabCompletionCallbacks
  ): void {
    const currentLine = callbacks.getCurrentLine()
    if (currentLine.endsWith(suffix)) {
      return
    }

    callbacks.updateLineAndRender(currentLine + suffix, suffix)
  }

  private completePartialToken(
    currentToken: string,
    result: CompletionResult,
    callbacks: TabCompletionCallbacks
  ): void {
    const currentLine = callbacks.getCurrentLine()
    const toAdd = result.text.slice(currentToken.length) + result.suffix
    callbacks.updateLineAndRender(currentLine + toAdd, toAdd)
  }

  private handleDoubleTab(
    completionResults: CompletionResult[],
    callbacks: TabCompletionCallbacks
  ): void {
    const currentLine = callbacks.getCurrentLine()
    const suggestions = this.formatSuggestions(
      completionResults.map((r) => r.text)
    )

    callbacks.write('\r\n')
    callbacks.write(suggestions)
    callbacks.write('\r\n')
    callbacks.showPrompt()
    callbacks.write(currentLine)
    callbacks.updateCurrentLine(currentLine, currentLine.length)
  }

  private handleCommonPrefix(
    completionResults: CompletionResult[],
    callbacks: TabCompletionCallbacks
  ): void {
    const prefix = this.getCommonPrefix(completionResults.map((r) => r.text))
    const currentToken = callbacks.getCurrentToken()
    const toAdd = prefix.slice(currentToken.length)

    if (!toAdd) {
      return
    }

    const currentLine = callbacks.getCurrentLine()
    callbacks.updateLineAndRender(currentLine + toAdd, toAdd)
  }
}
