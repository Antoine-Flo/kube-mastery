// ═══════════════════════════════════════════════════════════════════════════
// AUTOCOMPLETE PROVIDER
// ═══════════════════════════════════════════════════════════════════════════
// Interface abstraite pour les providers d'autocomplete
// Chaque module (shell, kubectl, filesystem) peut implémenter son propre provider

import type { AutocompleteContext, CompletionResult } from './types'

export abstract class AutocompleteProvider {
    /**
     * Priorité du provider (plus bas = exécuté en premier)
     * Permet de contrôler l'ordre d'exécution des providers
     */
    abstract priority(): number

    /**
     * Détermine si ce provider peut gérer l'autocomplete pour cette ligne
     * @param tokens - Tokens de la ligne (séparés par espaces)
     * @param currentToken - Token actuellement en cours de frappe
     * @param line - Ligne complète
     */
    abstract match(tokens: string[], currentToken: string, line: string): boolean

    /**
     * Génère les suggestions d'autocomplete
     * @param tokens - Tokens de la ligne
     * @param currentToken - Token actuellement en cours de frappe
     * @param context - Contexte (clusterState, fileSystem)
     */
    abstract complete(tokens: string[], currentToken: string, context: AutocompleteContext): CompletionResult[]
}
