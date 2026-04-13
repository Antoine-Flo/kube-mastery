// ═══════════════════════════════════════════════════════════════════════════
// TERMINAL MOUNT
// ═══════════════════════════════════════════════════════════════════════════
// Mounts jQuery Terminal with seed-based EmulatedEnvironment.

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
  getTerminalRenderer,
  initTerminalManager,
  isTerminalInputLocked,
  lockTerminalInput,
  syncTerminalPrompt,
  unlockTerminalInput,
  updateTerminalTheme
} from '../core/terminal/TerminalManager'
import { createLogger } from '../logger/Logger'

function getTheme(): 'dark' | 'light' {
  return document.documentElement.getAttribute('data-theme') === 'light'
    ? 'light'
    : 'dark'
}

export interface MountTerminalOptions {
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

/** Mounts terminal, returns cleanup (detach + destroy env). */
export function mountTerminal(
  container: HTMLElement,
  options: MountTerminalOptions = {}
): () => void {
  const {
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
    theme: getTheme
  })

  let dispatcher: ReturnType<typeof createCommandDispatcher> | null = null

  const attachId = attachTerminal({
    container,
    environment: env,
    topPrompt,
    onCommand(command: string) {
      if (!dispatcher) {
        const renderer = getTerminalRenderer()
        if (renderer == null) {
          return
        }
        try {
          if (env.networkRuntime == null) {
            throw new Error('Terminal environment is missing network runtime')
          }
          const fileSystem = createFileSystem(
            env.fileSystemState,
            env.apiServer.eventBus,
            { mutable: true }
          )
          dispatcher = createCommandDispatcher({
            fileSystem,
            editorModal,
            renderer,
            shellContextStack: env.shellContextStack,
            apiServer: env.apiServer,
            networkRuntime: env.networkRuntime,
            metricsProvider: env.metricsProvider,
            logger,
            commandLimit,
            commandLimitMessage,
            lockInput: lockTerminalInput,
            unlockInput: unlockTerminalInput,
            isInputLocked: isTerminalInputLocked
          })
        } catch (err) {
          console.error('[Terminal] Failed to create dispatcher:', err)
          return
        }
      }
      dispatcher.execute(command)
      syncTerminalPrompt()
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
