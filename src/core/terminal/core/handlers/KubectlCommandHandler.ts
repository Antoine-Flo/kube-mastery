// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Handler pour les commandes kubectl.
// Délègue l'exécution au kubectl executor.

import { createKubectlExecutor } from '../../../kubectl/commands/executor'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import type { CommandContext } from '../CommandContext'
import type { CommandHandler } from '../CommandHandler'

type ParsedRedirection = {
  command: string
  outputFile?: string
}

const parseKubectlOutputRedirection = (
  command: string
): ExecutionResult & { parsed?: ParsedRedirection } => {
  const trimmed = command.trim()
  const segments = trimmed.split('>')

  if (segments.length === 1) {
    return {
      ok: true,
      value: '',
      parsed: {
        command: trimmed
      }
    }
  }

  if (segments.length !== 2) {
    return error('unsupported output redirection syntax')
  }

  const commandPart = segments[0].trim()
  const outputFile = segments[1].trim()

  if (commandPart.length === 0) {
    return error('missing kubectl command before output redirection')
  }
  if (outputFile.length === 0) {
    return error('missing output file after redirection operator')
  }
  if (outputFile.includes(' ')) {
    return error('output redirection supports only one target file')
  }

  return {
    ok: true,
    value: '',
    parsed: {
      command: commandPart,
      outputFile
    }
  }
}

export class KubectlCommandHandler implements CommandHandler {
  canHandle(command: string): boolean {
    // Vérifie si la commande commence par "kubectl" suivi d'un espace ou fin de ligne
    const trimmed = command.trim()
    return trimmed === 'kubectl' || trimmed.startsWith('kubectl ')
  }

  execute(command: string, context: CommandContext): ExecutionResult {
    const parseRedirectionResult = parseKubectlOutputRedirection(command)
    if (!parseRedirectionResult.ok || parseRedirectionResult.parsed == null) {
      const redirectionError = parseRedirectionResult.ok
        ? 'invalid output redirection'
        : parseRedirectionResult.error
      context.output.writeOutput(redirectionError)
      return error(redirectionError)
    }

    const parsedRedirection = parseRedirectionResult.parsed

    // Créer l'executor avec les dépendances du contexte
    const executor = createKubectlExecutor(
      context.clusterState,
      context.fileSystem,
      context.logger,
      context.eventBus,
      context.networkRuntime
    )

    // Exécuter la commande kubectl
    const result = executor.execute(parsedRedirection.command)

    if (parsedRedirection.outputFile != null) {
      if (!result.ok) {
        context.output.writeOutput(result.error)
        return result
      }

      const outputToWrite = result.value || ''
      const writeResult = context.fileSystem.writeFile(
        parsedRedirection.outputFile,
        outputToWrite
      )
      if (!writeResult.ok) {
        context.output.writeOutput(writeResult.error)
        return error(writeResult.error)
      }

      return success('')
    }

    // Afficher le résultat dans le terminal
    if (result.ok) {
      if (result.value) {
        context.output.writeOutput(result.value)
      }
    } else {
      context.output.writeOutput(result.error)
    }

    return result
  }
}
