// ═══════════════════════════════════════════════════════════════════════════
// COMMAND DISPATCHER
// ═══════════════════════════════════════════════════════════════════════════
// Dispatcher de commandes utilisant le Strategy Pattern.
// Route les commandes vers le premier handler qui peut les traiter.

import type { ClusterState } from '../../cluster/ClusterState'
import type { EventBus } from '../../cluster/events/EventBus'
import type { FileSystem } from '../../../core/filesystem/FileSystem'
import type { Logger } from '../../../logger/Logger'
import type { ExecutionResult } from '../../shared/result'
import { error } from '../../shared/result'
import type { EditorModal } from '../../shell/commands'
import type { TerminalRenderer } from '../renderer/TerminalRenderer'
import type { CommandContext } from './CommandContext'
import type { CommandHandler } from './CommandHandler'
import { KubectlCommandHandler } from './handlers/KubectlCommandHandler'
import { ShellCommandHandler } from './handlers/ShellCommandHandler'
import type { ShellContextStack } from './ShellContext'
import { createTerminalOutput } from './TerminalOutput'

interface CommandDispatcherOptions {
    fileSystem: FileSystem
    editorModal?: EditorModal
    renderer: TerminalRenderer
    shellContextStack: ShellContextStack
    clusterState: ClusterState
    eventBus: EventBus
    logger: Logger
}

export class CommandDispatcher {
    private handlers: CommandHandler[]
    private context: CommandContext

    constructor(options: CommandDispatcherOptions) {
        // Créer l'abstraction TerminalOutput pour une gestion propre des lignes
        const output = createTerminalOutput(options.renderer)

        this.context = {
            fileSystem: options.fileSystem,
            editorModal: options.editorModal,
            renderer: options.renderer,
            output,
            shellContextStack: options.shellContextStack,
            clusterState: options.clusterState,
            eventBus: options.eventBus,
            logger: options.logger,
        }

        // Ordre important : les handlers sont testés dans l'ordre
        // ShellCommandHandler en premier car il peut parser rapidement
        this.handlers = [
            new ShellCommandHandler(),
            new KubectlCommandHandler(),
        ]
    }

    /**
     * Exécute une commande en la routant vers le bon handler
     * @param command - Commande brute (ex: "ls -l", "kubectl get pods")
     * @returns Résultat d'exécution
     */
    execute(command: string): ExecutionResult {
        // Trouver le premier handler qui peut traiter la commande
        const handler = this.handlers.find(h => h.canHandle(command))

        if (!handler) {
            this.context.output.writeError(`Unknown command: ${command}`)
            return error(`Unknown command: ${command}`)
        }

        // Exécuter la commande via le handler
        return handler.execute(command, this.context)
    }
}

/**
 * Factory function pour créer un CommandDispatcher
 * @param options - Options de configuration
 * @returns Instance de CommandDispatcher
 */
export const createCommandDispatcher = (
    options: CommandDispatcherOptions
): CommandDispatcher => {
    return new CommandDispatcher(options)
}
