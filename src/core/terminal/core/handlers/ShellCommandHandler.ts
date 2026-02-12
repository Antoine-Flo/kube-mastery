// ═══════════════════════════════════════════════════════════════════════════
// SHELL COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Handler pour les commandes shell (cd, ls, cat, etc.)
// Utilise ShellCommandExecutor et affiche les résultats dans le terminal.

import type { ExecutionResult } from '../../../shared/result'
import { error } from '../../../shared/result'
import { createShellExecutor, parseShellCommand } from '../../../shell/commands'
import type { CommandContext } from '../CommandContext'
import type { CommandHandler } from '../CommandHandler'

export class ShellCommandHandler implements CommandHandler {
  canHandle(command: string): boolean {
    // Vérifie si la commande est une commande shell valide
    const parseResult = parseShellCommand(command)
    return parseResult.ok
  }

  execute(command: string, context: CommandContext): ExecutionResult {
    // Parser la commande pour vérifier qu'elle est valide
    const parseResult = parseShellCommand(command)
    if (!parseResult.ok) {
      context.output.writeError(parseResult.error)
      return error(parseResult.error)
    }

    // Créer l'executor avec le filesystem et l'editor modal
    const executor = createShellExecutor(
      context.fileSystem,
      context.editorModal
    )

    // Exécuter la commande
    const result = executor.execute(command)

    // Gérer les commandes spéciales avec effets de bord
    const parsed = parseResult.value
    if (parsed.command === 'clear') {
      // Effacer le terminal (séquence ANSI spéciale)
      context.renderer.write('\x1b[2J\x1b[H')
      return result
    }

    if (parsed.command === 'cd' && result.ok) {
      // Mettre à jour le prompt après un cd réussi
      context.shellContextStack.updateCurrentPrompt()
    }

    // Afficher le résultat (succès ou erreur)
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
