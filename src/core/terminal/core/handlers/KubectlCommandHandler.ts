// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Handler pour les commandes kubectl.
// Délègue l'exécution au kubectl executor.

import { createKubectlExecutor } from '../../../kubectl/commands/executor'
import type { ExecutionResult } from '../../../shared/result'
import type { CommandContext } from '../CommandContext'
import type { CommandHandler } from '../CommandHandler'

export class KubectlCommandHandler implements CommandHandler {
  canHandle(command: string): boolean {
    // Vérifie si la commande commence par "kubectl" suivi d'un espace ou fin de ligne
    const trimmed = command.trim()
    return trimmed === 'kubectl' || trimmed.startsWith('kubectl ')
  }

  execute(command: string, context: CommandContext): ExecutionResult {
    // Créer l'executor avec les dépendances du contexte
    const executor = createKubectlExecutor(
      context.clusterState,
      context.fileSystem,
      context.logger,
      context.eventBus
    )

    // Exécuter la commande kubectl
    const result = executor.execute(command)

    // Afficher le résultat dans le terminal
    if (result.ok) {
      if (result.value) {
        context.output.writeOutput(result.value)
      }
    } else {
      context.output.writeError(result.error)
    }

    return result
  }
}
