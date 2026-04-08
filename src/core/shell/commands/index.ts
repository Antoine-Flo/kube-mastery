// ═══════════════════════════════════════════════════════════════════════════
// SHELL COMMANDS - PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════
// Public exports for shell command system.

import {
  createShellCommandExecutor,
  ShellCommandExecutor
} from './core/ShellCommandExecutor'
import type { ShellCommandHandler } from './core/ShellCommandHandler'
import { parseShellCommand } from './core/ShellCommandParser'
import type { SimTrafficPodIdentity } from '../../network/TrafficEngine'
import type { ExecutionResult } from '../../shared/result'
import type { Result } from '../../shared/result'
import type { ParsedShellCommand } from './core/types'
import { createFileSystem } from '../../filesystem/FileSystem'
import { createHostFileSystem } from '../../filesystem/debianFileSystem'

// Handlers
import { createNanoHandler } from './handlers/editor/nano'
import { createCatHandler } from './handlers/fileops/cat'
import { createEchoHandler } from './handlers/fileops/echo'
import { createMkdirHandler } from './handlers/fileops/mkdir'
import { createRmHandler } from './handlers/fileops/rm'
import { createTouchHandler } from './handlers/fileops/touch'
import { createCdHandler } from './handlers/navigation/cd'
import { createLsHandler } from './handlers/navigation/ls'
import { createPwdHandler } from './handlers/navigation/pwd'
import { createCurlHandler } from './handlers/network/curl'
import { createNslookupHandler } from './handlers/network/nslookup'
import { createClearHandler } from './handlers/system/clear'
import { createDebugHandler } from './handlers/system/debug'
import { createEnvHandler } from './handlers/system/env'
import { createExitHandler } from './handlers/system/exit'
import { createHelpHandler } from './handlers/system/help'
import { createSleepHandler } from './handlers/system/sleep'

// Types
export { parseShellCommand }
export { executeSequentialShellScript } from './shellScriptRunner'
export { parseSequentialShellScript } from './shellScriptRunner'
export type { ParsedShellCommand, ShellCommandHandler }

// Re-export FileSystem from canonical source
import type { FileSystem } from '../../filesystem/FileSystem'
export type { FileSystem }

export type EditorModal = {
  open: (
    filename: string,
    content: string,
    onSave: (newContent: string) => boolean | void,
    onCancel?: () => void
  ) => void
}

export interface ShellRuntimeOptions {
  resolveNamespace?: () => string
  runDnsLookup?: (query: string, namespace: string) => ExecutionResult
  runCurl?: (
    target: string,
    namespace: string,
    sourcePod?: SimTrafficPodIdentity
  ) => ExecutionResult
  getSimTrafficSourcePod?: () => SimTrafficPodIdentity | undefined
  getEnvironmentVariables?: () => Result<string[]>
  onExit?: () => ExecutionResult
}

let cachedRegistryCommandNames: readonly string[] | undefined

/**
 * Sorted command names registered by `buildShellHandlersMap` (for parser / routing).
 */
export const getShellRegistryCommandNames = (): readonly string[] => {
  if (cachedRegistryCommandNames == null) {
    const fileSystem = createFileSystem(createHostFileSystem())
    const handlers = buildShellHandlersMap(fileSystem)
    cachedRegistryCommandNames = Object.freeze(
      [...handlers.keys()].sort((a, b) => {
        return a.localeCompare(b)
      })
    )
  }
  return cachedRegistryCommandNames
}

/**
 * Create all shell command handlers (single registry for host and container).
 */
export const buildShellHandlersMap = (
  fileSystem: FileSystem,
  editorModal?: EditorModal,
  runtimeOptions: ShellRuntimeOptions = {}
): Map<string, ShellCommandHandler> => {
  const handlers = new Map<string, ShellCommandHandler>()

  // Navigation
  handlers.set('pwd', createPwdHandler(fileSystem))
  handlers.set('cd', createCdHandler(fileSystem))
  handlers.set('ls', createLsHandler(fileSystem))

  // File operations
  handlers.set('touch', createTouchHandler(fileSystem))
  handlers.set('cat', createCatHandler(fileSystem))
  handlers.set('echo', createEchoHandler(fileSystem))
  handlers.set('rm', createRmHandler(fileSystem))
  handlers.set('mkdir', createMkdirHandler(fileSystem))

  // Editor
  handlers.set('nano', createNanoHandler(fileSystem, editorModal))
  handlers.set('vi', createNanoHandler(fileSystem, editorModal)) // Alias for nano
  handlers.set('vim', createNanoHandler(fileSystem, editorModal)) // Alias for nano

  // System
  handlers.set('clear', createClearHandler())
  handlers.set('help', createHelpHandler())
  handlers.set('debug', createDebugHandler())
  handlers.set('sleep', createSleepHandler())
  handlers.set(
    'env',
    createEnvHandler({
      getEnvironmentVariables: runtimeOptions.getEnvironmentVariables
    })
  )
  handlers.set('exit', createExitHandler({ onExit: runtimeOptions.onExit }))
  handlers.set(
    'nslookup',
    createNslookupHandler({
      resolveNamespace: runtimeOptions.resolveNamespace,
      runDnsLookup: runtimeOptions.runDnsLookup
    })
  )
  handlers.set(
    'curl',
    createCurlHandler({
      resolveNamespace: runtimeOptions.resolveNamespace,
      runCurl: runtimeOptions.runCurl,
      getSimTrafficSourcePod: runtimeOptions.getSimTrafficSourcePod
    })
  )

  return handlers
}

/**
 * Create a shell command executor with all handlers
 * @param fileSystem - The file system to operate on
 * @param editorModal - Optional editor modal for nano command
 * @returns ShellCommandExecutor instance
 */
export const createShellExecutor = (
  fileSystem: FileSystem,
  editorModal?: EditorModal,
  runtimeOptions: ShellRuntimeOptions = {}
): ShellCommandExecutor => {
  const handlers = buildShellHandlersMap(fileSystem, editorModal, runtimeOptions)
  return createShellCommandExecutor(handlers)
}
