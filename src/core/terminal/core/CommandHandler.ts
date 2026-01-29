// ═══════════════════════════════════════════════════════════════════════════
// COMMAND HANDLER INTERFACE (Strategy Pattern)
// ═══════════════════════════════════════════════════════════════════════════
// Interface Strategy pour les handlers de commandes.
// Chaque type de commande (shell, kubectl, etc.) implémente cette interface.

import type { ExecutionResult } from '../../shared/result'
import type { CommandContext } from './CommandContext'

/**
 * Interface Strategy pour les handlers de commandes
 * Permet de router les commandes vers le bon handler selon leur type
 */
export interface CommandHandler {
    /**
     * Vérifie si ce handler peut traiter la commande donnée
     * @param command - Commande brute (ex: "ls -l", "kubectl get pods")
     * @returns true si ce handler peut traiter la commande
     */
    canHandle(command: string): boolean

    /**
     * Exécute la commande et retourne le résultat
     * @param command - Commande brute
     * @param context - Contexte d'exécution (filesystem, renderer, etc.)
     * @returns Résultat d'exécution (succès ou erreur)
     */
    execute(command: string, context: CommandContext): ExecutionResult
}
