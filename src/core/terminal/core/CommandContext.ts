// ═══════════════════════════════════════════════════════════════════════════
// COMMAND CONTEXT
// ═══════════════════════════════════════════════════════════════════════════
// Contexte partagé pour l'exécution des commandes.
// Contient toutes les dépendances nécessaires aux handlers.

import type { ClusterState } from '~/core/cluster/ClusterState'
import type { EventBus } from '~/core/cluster/events/EventBus'
import type { FileSystem } from '../../../core/filesystem/FileSystem'
import type { Logger } from '../../../logger/Logger'
import type { EditorModal } from '../../shell/commands'
import type { TerminalRenderer } from '../renderer/TerminalRenderer'
import type { ShellContextStack } from './ShellContext'
import type { TerminalOutput } from './TerminalOutput'

/**
 * Contexte d'exécution pour les commandes
 * Contient toutes les dépendances nécessaires aux handlers
 */
export interface CommandContext {
    /** Filesystem complet pour les opérations sur fichiers */
    fileSystem: FileSystem

    /** Modal d'édition pour les commandes comme nano */
    editorModal?: EditorModal

    /** Renderer pour afficher les résultats dans le terminal */
    renderer: TerminalRenderer

    /** Sortie terminal avec gestion automatique des sauts de ligne */
    output: TerminalOutput

    /** Stack de contextes shell pour gérer le prompt et le filesystem */
    shellContextStack: ShellContextStack

    /** État du cluster Kubernetes */
    clusterState: ClusterState

    /** Bus d'événements pour l'architecture event-driven */
    eventBus: EventBus

    /** Logger pour le suivi des commandes */
    logger: Logger
}
