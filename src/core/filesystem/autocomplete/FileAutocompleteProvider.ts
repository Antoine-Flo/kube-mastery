// ═══════════════════════════════════════════════════════════════════════════
// FILESYSTEM AUTOCOMPLETE PROVIDER
// ═══════════════════════════════════════════════════════════════════════════
// Provider d'autocomplete pour les fichiers et dossiers

import { AutocompleteProvider } from '../../terminal/autocomplete/AutocompleteProvider'
import type {
  AutocompleteContext,
  CompletionResult
} from '../../terminal/autocomplete/types'

// Commandes qui acceptent des fichiers/dossiers comme arguments
const FILE_COMMANDS = ['cd', 'ls', 'cat', 'nano', 'rm', 'vi', 'vim'] as const
const FILE_COMMAND_SET = new Set<string>(FILE_COMMANDS)

/**
 * Get file/directory completions from filesystem (current directory only)
 */
const getFileCompletions = (
  currentToken: string,
  fileSystem: AutocompleteContext['fileSystem'],
  directoriesOnly: boolean
): CompletionResult[] => {
  // Pour l'instant, on retourne un tableau vide car le filesystem n'est pas encore complètement migré
  // TODO: Implémenter quand FileSystem sera migré avec listDirectory
  try {
    const currentPath = fileSystem.getCurrentPath()
    // Le filesystem actuel n'a pas encore listDirectory, donc on retourne vide pour l'instant
    return []
  } catch {
    return []
  }
}

export class FileAutocompleteProvider extends AutocompleteProvider {
  priority(): number {
    return 50 // Priorité haute = exécuté après les commandes et kubectl
  }

  match(tokens: string[], _currentToken: string, _line: string): boolean {
    if (tokens.length === 0) {
      return false
    }
    const command = tokens[0]
    return FILE_COMMAND_SET.has(command)
  }

  complete(
    tokens: string[],
    currentToken: string,
    context: AutocompleteContext
  ): CompletionResult[] {
    const command = tokens[0]
    const directoriesOnly = command === 'cd'
    return getFileCompletions(currentToken, context.fileSystem, directoriesOnly)
  }
}
