// ═══════════════════════════════════════════════════════════════════════════
// TERMINAL MOUNT
// ═══════════════════════════════════════════════════════════════════════════
// Mounts xterm with seed-based EmulatedEnvironment. CommandDispatcher on first command.

import {
  createEmulatedEnvironment,
  destroyEmulatedEnvironment
} from '../core/emulatedEnvironment/EmulatedEnvironmentManager'
import type { EmulatedEnvironment } from '../core/emulatedEnvironment/EmulatedEnvironment'
import { fsConfig as demoFsConfig } from '../courses/seeds/demo'
import { getSeed } from '../courses/seeds/getSeed'
import { createFilesystemFromConfig } from '../core/filesystem/debianFileSystem'
import { createFileSystem } from '../core/filesystem/FileSystem'
import type { EditorModal } from '../core/shell/commands'
import { createCommandDispatcher } from '../core/terminal/core/CommandDispatcher'
import {
  attachTerminal,
  detachTerminal,
  getTerminalController,
  initTerminalManager,
  updateTerminalTheme
} from '../core/terminal/TerminalManager'
import { createLogger } from '../logger/Logger'

function getTheme(): 'dark' | 'light' {
  return document.documentElement.getAttribute('data-theme') === 'light'
    ? 'light'
    : 'dark'
}

export interface MountTerminalOptions {
  rows?: number
  scrollback?: number
  /** Language (en/fr). Default en. */
  lang?: 'en' | 'fr'
  /** Seed name for lesson pages (uses getSeed). If omitted, uses demo seed (home page). Ignored if env is set. */
  seedName?: string
  /** Optional text written at top when terminal loads (e.g. home banner). Omitted = none. */
  topPrompt?: string
  /** Shared environment (e.g. from lesson page). If set, it is used and not destroyed on cleanup. */
  env?: EmulatedEnvironment
  /** Editor overlay for vim/nano. If set, nano/vi/vim open this modal. */
  editorModal?: EditorModal & { close?(): void }
  /** Optional command limit for demo terminals. */
  commandLimit?: number
  /** Message shown when command limit is reached. */
  commandLimitMessage?: string
}

/** Mounts xterm, returns cleanup (detach + destroy env). */
export function mountTerminal(
  container: HTMLElement,
  options: MountTerminalOptions = {}
): () => void {
  const {
    rows = 20,
    scrollback = 1000,
    lang = 'en',
    seedName,
    topPrompt,
    env: providedEnv,
    editorModal,
    commandLimit,
    commandLimitMessage
  } = options

  const env: EmulatedEnvironment =
    providedEnv ??
    (() => {
      const seed = seedName ? getSeed(seedName) : { fsConfig: demoFsConfig }
      return createEmulatedEnvironment({
        filesystemState: createFilesystemFromConfig(seed.fsConfig ?? {})
      })
    })()
  const logger = createLogger({ mirrorToConsole: false })

  initTerminalManager({
    theme: getTheme,
    rows,
    scrollback
  })

  let dispatcher: ReturnType<typeof createCommandDispatcher> | null = null

  const attachId = attachTerminal({
    container,
    environment: env,
    topPrompt,
    onCommand(command: string) {
      if (!dispatcher) {
        const controller = getTerminalController()
        if (!controller) {
          return
        }
        try {
          const fileSystem = createFileSystem(
            env.fileSystemState,
            env.eventBus,
            { mutable: true }
          )
          dispatcher = createCommandDispatcher({
            fileSystem,
            editorModal,
            renderer: controller.getRenderer(),
            shellContextStack: env.shellContextStack,
            clusterState: env.clusterState,
            eventBus: env.eventBus,
            networkRuntime: env.networkRuntime,
            logger,
            commandLimit,
            commandLimitMessage,
            lockInput: () => controller.lockInput(),
            unlockInput: () => controller.unlockInput(),
            isInputLocked: () => controller.isInputLocked()
          })
        } catch (err) {
          console.error('[Terminal] Failed to create dispatcher:', err)
          return
        }
      }
      dispatcher.execute(command)
      getTerminalController()?.updatePrompt()
    },
    onInterrupt() {
      if (dispatcher == null) {
        return false
      }
      if (!dispatcher.hasActiveStream()) {
        return false
      }
      dispatcher.stopActiveStream()
      return true
    }
  })

  const observer = new MutationObserver(() => updateTerminalTheme())
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme']
  })

  return function cleanup() {
    observer.disconnect()
    editorModal?.close?.()
    detachTerminal(attachId)
    dispatcher = null
    if (!providedEnv) destroyEmulatedEnvironment(env)
  }
}
