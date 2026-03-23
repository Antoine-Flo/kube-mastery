// ═══════════════════════════════════════════════════════════════════════════
// COMMAND CONTEXT
// ═══════════════════════════════════════════════════════════════════════════
// Contexte partagé pour l'exécution des commandes.
// Contient toutes les dépendances nécessaires aux handlers.

import type { ApiServerFacade } from '~/core/api/ApiServerFacade'
import type { FileSystem } from '../../../core/filesystem/FileSystem'
import type { SimNetworkRuntime } from '../../../core/network/SimNetworkRuntime'
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

  /** API facade for apiserver-like access */
  apiServer: ApiServerFacade

  /** Simulated network runtime (DNS, service routing, traffic) */
  networkRuntime: SimNetworkRuntime

  /** Logger pour le suivi des commandes */
  logger: Logger

  /** Verrouille l'entrée utilisateur (mode démo) */
  lockInput?: () => void

  /** Déverrouille l'entrée utilisateur */
  unlockInput?: () => void

  /** Indique si l'entrée est verrouillée */
  isInputLocked?: () => boolean

  /** Register cleanup callback for long-running stream command */
  startStream?: (stop: () => void) => void

  /** Stop currently active stream command */
  stopStream?: () => void
}
