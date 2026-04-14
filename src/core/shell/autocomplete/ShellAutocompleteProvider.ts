// ═══════════════════════════════════════════════════════════════════════════
// SHELL AUTOCOMPLETE PROVIDER
// ═══════════════════════════════════════════════════════════════════════════
// Provider d'autocomplete pour les commandes shell (cd, ls, pwd, etc.)

import { AutocompleteProvider } from '../../terminal/autocomplete/AutocompleteProvider'
import type {
  AutocompleteContext,
  CompletionResult
} from '../../terminal/autocomplete/types'

// Commandes shell valides
const SHELL_COMMANDS = [
  'cd',
  'ls',
  'pwd',
  'mkdir',
  'touch',
  'cat',
  'rm',
  'mv',
  'clear',
  'help',
  'debug',
  'nano',
  'vi',
  'vim'
] as const

// Commandes qui acceptent kubectl en plus
const ALL_COMMANDS = ['kubectl', ...SHELL_COMMANDS]

/**
 * Filter array to items that start with prefix (case-sensitive)
 */
const filterMatches = (items: string[], prefix: string): string[] => {
  if (!prefix) {
    return items
  }
  return items.filter((item) => item.startsWith(prefix))
}

export class ShellAutocompleteProvider extends AutocompleteProvider {
  priority(): number {
    return 10 // Priorité basse = exécuté en premier (commandes de base)
  }

  match(tokens: string[], _currentToken: string, line: string): boolean {
    // Match si on est au début (pas de tokens) ou sur le premier token
    return tokens.length === 0 || (tokens.length === 1 && !line.endsWith(' '))
  }

  complete(
    _tokens: string[],
    currentToken: string,
    _context: AutocompleteContext
  ): CompletionResult[] {
    return filterMatches(ALL_COMMANDS, currentToken).map((cmd) => ({
      text: cmd,
      suffix: ' '
    }))
  }
}
