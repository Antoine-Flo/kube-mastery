// ═══════════════════════════════════════════════════════════════════════════
// AUTOCOMPLETE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════
// Exports publics pour le système d'autocomplete

import { AutocompleteEngine } from './AutocompleteEngine'
export type { AutocompleteContext, CompletionResult } from './types'

// Imports des providers
import { FileAutocompleteProvider } from '../../../core/filesystem/autocomplete/FileAutocompleteProvider'
import { KubectlAutocompleteProvider } from '../../kubectl/autocomplete/KubectlAutocompleteProvider'
import { ShellAutocompleteProvider } from '../../shell/autocomplete/ShellAutocompleteProvider'

/**
 * Crée un AutocompleteEngine avec les providers par défaut
 * Chaque module (shell, kubectl, filesystem) gère son propre provider
 */
export const createDefaultAutocompleteEngine = (): AutocompleteEngine => {
  const engine = new AutocompleteEngine()

  // Enregistrer les providers dans l'ordre de priorité
  engine.registerProvider(new ShellAutocompleteProvider())
  engine.registerProvider(new KubectlAutocompleteProvider())
  engine.registerProvider(new FileAutocompleteProvider())

  return engine
}
