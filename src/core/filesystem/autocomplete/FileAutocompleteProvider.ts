// ═══════════════════════════════════════════════════════════════════════════
// FILESYSTEM AUTOCOMPLETE PROVIDER
// ═══════════════════════════════════════════════════════════════════════════
// Autocomplete provider for file and directory arguments

import { AutocompleteProvider } from '../../terminal/autocomplete/AutocompleteProvider'
import type {
  AutocompleteContext,
  CompletionResult
} from '../../terminal/autocomplete/types'

// Shell commands that take file or directory path arguments
const FILE_COMMANDS = ['cd', 'ls', 'cat', 'nano', 'rm', 'vi', 'vim'] as const
const FILE_COMMAND_SET = new Set<string>(FILE_COMMANDS)

/**
 * Get file/directory completions from filesystem (current directory only)
 */
const getFileCompletions = (
  fileSystem: AutocompleteContext['fileSystem']
): CompletionResult[] => {
  // Returns empty until listDirectory exists on the virtual filesystem
  // TODO: When implemented, use current token prefix and directories-only mode for `cd`
  try {
    void fileSystem.getCurrentPath()
    return []
  } catch {
    return []
  }
}

export class FileAutocompleteProvider extends AutocompleteProvider {
  priority(): number {
    return 50 // Higher number: runs after shell and kubectl providers
  }

  match(tokens: string[], _currentToken: string, _line: string): boolean {
    if (tokens.length === 0) {
      return false
    }
    const command = tokens[0]
    return FILE_COMMAND_SET.has(command)
  }

  complete(
    _tokens: string[],
    _currentToken: string,
    context: AutocompleteContext
  ): CompletionResult[] {
    return getFileCompletions(context.fileSystem)
  }
}
