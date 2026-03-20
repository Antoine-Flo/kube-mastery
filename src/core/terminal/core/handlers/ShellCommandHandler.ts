// ═══════════════════════════════════════════════════════════════════════════
// SHELL COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Handler pour les commandes shell (cd, ls, cat, etc.)
// Utilise ShellCommandExecutor et affiche les résultats dans le terminal.

import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import { createShellExecutor, parseShellCommand } from '../../../shell/commands'
import {
  buildContainerEnvironmentVariables,
  buildHostEnvironmentVariables
} from './containerEnvironment'
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
    const activeFileSystem = context.shellContextStack.getCurrentFileSystem()
    const executor = createShellExecutor(
      activeFileSystem,
      context.editorModal,
      {
        resolveNamespace: () => {
          const containerInfo =
            context.shellContextStack.getCurrentContainerInfo()
          return containerInfo?.namespace ?? 'default'
        },
        runDnsLookup: (query, namespace) => {
          if (context.networkRuntime == null) {
            return error('network runtime is not available')
          }
          const dnsResult = context.networkRuntime.dnsResolver.resolveARecord(
            query,
            namespace
          )
          if (!dnsResult.ok) {
            return error(dnsResult.error)
          }
          const address = dnsResult.value.addresses[0]
          return success(
            [
              'Server:\t10.96.0.10',
              'Address:\t10.96.0.10:53',
              '',
              `Name:\t${dnsResult.value.fqdn}`,
              `Address:\t${address}`
            ].join('\n')
          )
        },
        runCurl: (target, namespace) => {
          if (context.networkRuntime == null) {
            return error('network runtime is not available')
          }
          const curlResult =
            context.networkRuntime.trafficEngine.simulateHttpGet(target, {
              sourceNamespace: namespace
            })
          if (!curlResult.ok) {
            return error(curlResult.error)
          }
          return success(curlResult.value)
        },
        getEnvironmentVariables: () => {
          const containerInfo =
            context.shellContextStack.getCurrentContainerInfo()
          if (containerInfo == null) {
            return success(buildHostEnvironmentVariables())
          }
          const podResult = context.apiServer.findResource(
            'Pod',
            containerInfo.podName,
            containerInfo.namespace
          )
          if (!podResult.ok) {
            return error(
              `Error from server (NotFound): pods "${containerInfo.podName}" not found`
            )
          }
          return buildContainerEnvironmentVariables(
            podResult.value,
            containerInfo.containerName
          )
        },
        onExit: () => {
          if (!context.shellContextStack.isInContainer()) {
            return success('')
          }
          const popped = context.shellContextStack.popContext()
          if (!popped) {
            return success('')
          }
          context.shellContextStack.updateCurrentPrompt()
          return success('')
        }
      }
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
