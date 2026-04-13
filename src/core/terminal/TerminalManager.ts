// ═══════════════════════════════════════════════════════════════════════════
// TERMINAL MANAGER
// ═══════════════════════════════════════════════════════════════════════════
// Gère le cycle de vie du terminal jQuery Terminal avec protection race conditions.

import $ from 'jquery'
import installJQueryTerminal from 'jquery.terminal'
import installUnixFormatting from 'jquery.terminal/js/unix_formatting'
import type { EmulatedEnvironment } from '../emulatedEnvironment/EmulatedEnvironment'
import type { KubectlCommandSpec } from '../kubectl/cli/model'
import { KUBECTL_ROOT_COMMAND_SPEC } from '../kubectl/cli/registry/root'
import { KUBECTL_RESOURCES } from '../kubectl/commands/resourceCatalog'
import { getShellRegistryCommandNames } from '../shell/commands'
import { createJQueryTerminalRenderer } from './renderer/JQueryTerminalRenderer'
import type { TerminalRenderer } from './renderer/TerminalRenderer'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TerminalManagerOptions {
  theme: () => 'dark' | 'light'
}

export interface AttachOptions {
  container: HTMLElement
  environment: EmulatedEnvironment
  /** Optional text written at top when terminal loads (e.g. home banner). Omitted = none. */
  topPrompt?: string
  onCommand?: (command: string) => void
  onInterrupt?: () => boolean
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

interface TerminalManagerState {
  terminal: JQueryTerminalInstance | null
  renderer: TerminalRenderer | null
  resizeObserver: ResizeObserver | null
  currentEnvironment: EmulatedEnvironment | null
  container: HTMLElement | null
  options: TerminalManagerOptions | null
  onCommandCallback: ((command: string) => void) | null
  onInterruptCallback: (() => boolean) | null
  inputLocked: boolean
  attachId: number
}

interface JQueryTerminalInstance {
  clear: () => void
  destroy: () => void
  disable: () => void
  enable: () => void
  echo: (value: string, options?: { raw?: boolean }) => void
  focus: () => void
  cols?: () => number
  resize?: (width?: number, height?: number) => JQueryTerminalInstance
  scroll_to_bottom?: () => JQueryTerminalInstance
  set_command: (value: string) => void
  set_prompt: (value: string) => void
  get_command?: () => string
}

const state: TerminalManagerState = {
  terminal: null,
  renderer: null,
  resizeObserver: null,
  currentEnvironment: null,
  container: null,
  options: null,
  onCommandCallback: null,
  onInterruptCallback: null,
  inputLocked: false,
  attachId: 0
}

let jqueryTerminalInstalled = false
let unixFormattingInstalled = false

const applyAnsiColorOverrides = (): void => {
  if ($.terminal == null || $.terminal.ansi_colors == null) {
    return
  }

  // Keep classic terminal mapping, but tune yellow to avoid orange tint.
  $.terminal.ansi_colors.normal.yellow = '#bf8f00'
  $.terminal.ansi_colors.bold.yellow = '#bf8f00'
  $.terminal.ansi_colors.faited.yellow = '#bf8f00'
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const resourceAliasCandidates = Object.values(KUBECTL_RESOURCES)
  .flatMap((aliases) => aliases)
  .sort((left, right) => left.localeCompare(right))

const findKubectlCommandByPath = (
  path: readonly string[]
): KubectlCommandSpec | undefined => {
  let current: KubectlCommandSpec = KUBECTL_ROOT_COMMAND_SPEC
  for (const segment of path) {
    const nextCommand = current.subcommands.find((subcommand) => {
      const commandSegment = subcommand.path[subcommand.path.length - 1]
      return commandSegment === segment
    })
    if (nextCommand == null) {
      return undefined
    }
    current = nextCommand
  }
  return current
}

const filterByPrefix = (
  values: readonly string[],
  prefix: string
): string[] => {
  const normalizedPrefix = prefix.trim()
  if (normalizedPrefix.length === 0) {
    return [...values]
  }
  return values.filter((value) => value.startsWith(normalizedPrefix))
}

const getVisibleFlagSuggestions = (
  commandSpec: KubectlCommandSpec | undefined,
  prefix: string
): string[] => {
  if (commandSpec == null) {
    return []
  }
  const flags = [
    ...KUBECTL_ROOT_COMMAND_SPEC.flags,
    ...commandSpec.flags
  ]
    .filter((flag) => !flag.hidden)
    .flatMap((flag) => {
      const longFlag = `--${flag.name}`
      if (flag.short == null) {
        return [longFlag]
      }
      return [longFlag, `-${flag.short}`]
    })
  const uniqueFlags = [...new Set(flags)]
  return filterByPrefix(uniqueFlags, prefix)
}

const buildCompletionCandidates = (command: string): string[] => {
  const shellCommands = [...getShellRegistryCommandNames()]
  const commandLine = command.trimStart()

  if (commandLine.length === 0) {
    return ['kubectl', ...shellCommands]
  }

  const tokens = commandLine.split(/\s+/).filter((token) => token.length > 0)
  if (tokens.length === 0) {
    return ['kubectl', ...shellCommands]
  }

  if (tokens[0] !== 'kubectl') {
    if (tokens.length > 1) {
      return []
    }
    return filterByPrefix(['kubectl', ...shellCommands], tokens[0])
  }

  const kubectlRootCommands = KUBECTL_ROOT_COMMAND_SPEC.subcommands.map(
    (subcommand) => subcommand.path[subcommand.path.length - 1]
  )

  if (tokens.length === 1) {
    return kubectlRootCommands
  }

  const kubectlArgs = tokens.slice(1)
  const activeToken = kubectlArgs[kubectlArgs.length - 1] ?? ''
  const basePath = kubectlArgs.slice(0, -1)

  if (basePath.length === 0) {
    return filterByPrefix(kubectlRootCommands, activeToken)
  }

  if (activeToken.startsWith('-')) {
    const resolvedCommand =
      findKubectlCommandByPath(basePath) ??
      findKubectlCommandByPath(basePath.slice(0, 1))
    return getVisibleFlagSuggestions(resolvedCommand, activeToken)
  }

  const headCommand = basePath[0]
  if (
    (headCommand === 'get' ||
      headCommand === 'describe' ||
      headCommand === 'delete') &&
    basePath.length === 1
  ) {
    return filterByPrefix(resourceAliasCandidates, activeToken)
  }

  const currentCommand = findKubectlCommandByPath(basePath)
  if (currentCommand == null) {
    return []
  }

  const subcommands = currentCommand.subcommands.map((subcommand) => {
    return subcommand.path[subcommand.path.length - 1]
  })
  return filterByPrefix(subcommands, activeToken)
}

const applyThemeToContainer = (): void => {
  if (state.container == null || state.options == null) {
    return
  }
  const isLightTheme = state.options.theme() === 'light'
  state.container.classList.toggle('jt-theme-light', isLightTheme)
  state.container.classList.toggle('jt-theme-dark', !isLightTheme)
}

const refreshPrompt = (): void => {
  if (state.terminal == null || state.currentEnvironment == null) {
    return
  }
  const prompt = state.currentEnvironment.shellContextStack.getCurrentPrompt()
  state.terminal.set_prompt(prompt)
}

const cleanup = () => {
  if (state.resizeObserver) {
    state.resizeObserver.disconnect()
    state.resizeObserver = null
  }
  if (state.renderer) {
    try {
      state.renderer.dispose()
    } catch {
      /* ignore */
    }
  }
  state.terminal = null
  state.renderer = null
  state.container = null
  state.inputLocked = false
}

const setupTerminal = (container: HTMLElement, topPrompt?: string) => {
  if (!state.options || !state.currentEnvironment) {
    return
  }
  if (!jqueryTerminalInstalled) {
    installJQueryTerminal(window, $)
    jqueryTerminalInstalled = true
  }
  if (!unixFormattingInstalled) {
    installUnixFormatting(window, $)
    applyAnsiColorOverrides()
    unixFormattingInstalled = true
  }

  container.innerHTML = ''
  const terminalElement = document.createElement('div')
  terminalElement.className = 'jt-terminal'
  container.appendChild(terminalElement)

  const terminal = ($(terminalElement) as unknown as {
    terminal: (
      interpreter: (command: string) => void,
      options: {
        greetings: false
        completion: (command: string, callback: (values: string[]) => void) => void
        keydown: (event: KeyboardEvent) => boolean
        prompt: () => string
        history: boolean
        outputLimit: number
        scrollOnEcho: boolean
        height: number
      }
    ) => JQueryTerminalInstance
  }).terminal(
    (command: string) => {
      if (state.inputLocked || state.onCommandCallback == null) {
        return
      }
      const normalizedCommand = command.trim()
      if (normalizedCommand.length === 0) {
        return
      }
      state.onCommandCallback(normalizedCommand)
    },
    {
      greetings: false,
      completion: function (
        this: JQueryTerminalInstance,
        commandValue: string,
        callback: (values: string[]) => void
      ): void {
        const currentLine = this.get_command?.() ?? commandValue
        callback(buildCompletionCandidates(currentLine))
      },
      keydown: (event: KeyboardEvent): boolean => {
        if (
          event.ctrlKey &&
          event.key.toLowerCase() === 'c' &&
          event.type === 'keydown'
        ) {
          const selectedText = window.getSelection()?.toString() ?? ''
          if (selectedText.length > 0) {
            return true
          }
          const interruptHandled = state.onInterruptCallback?.() === true
          if (interruptHandled) {
            terminal.set_command('')
          }
          return false
        }
        return true
      },
      prompt: () => {
        if (state.currentEnvironment == null) {
          return ''
        }
        return state.currentEnvironment.shellContextStack.getCurrentPrompt()
      },
      history: true,
      outputLimit: 2000,
      scrollOnEcho: true,
      height: Math.max(120, container.clientHeight)
    }
  )

  state.container = container
  state.terminal = terminal
  state.renderer = createJQueryTerminalRenderer(terminal)
  applyThemeToContainer()
  terminal.resize?.(container.clientWidth, Math.max(120, container.clientHeight))
  terminal.scroll_to_bottom?.()

  state.resizeObserver = new ResizeObserver(() => {
    if (state.terminal == null || state.container == null) {
      return
    }
    const height = Math.max(120, state.container.clientHeight)
    state.terminal.resize?.(state.container.clientWidth, height)
    state.terminal.scroll_to_bottom?.()
  })
  state.resizeObserver.observe(container)

  if (topPrompt) {
    state.renderer.write(`${topPrompt}\r\n`)
  }
  refreshPrompt()
  state.terminal.focus()
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

export const initTerminalManager = (options: TerminalManagerOptions): void => {
  state.options = options
}

export const attachTerminal = (options: AttachOptions): number => {
  const { container, environment, topPrompt, onCommand, onInterrupt } = options

  // Increment attach ID to track this attachment
  state.attachId++
  const currentAttachId = state.attachId

  if (!state.options) {
    console.error(
      '[TerminalManager] Not initialized. Call initTerminalManager first.'
    )
    return currentAttachId
  }

  // Clean up any existing terminal before creating new one
  cleanup()

  // Store new context
  state.onCommandCallback = onCommand ?? null
  state.onInterruptCallback = onInterrupt ?? null
  state.currentEnvironment = environment

  // Setup terminal with RAF to ensure container is mounted.
  requestAnimationFrame(() => {
    // Verify attachment is still valid (prevents race conditions)
    if (state.attachId !== currentAttachId) {
      return
    }
    setupTerminal(container, topPrompt)
  })

  return currentAttachId
}

export const detachTerminal = (attachId?: number): void => {
  // Skip if attachId doesn't match (prevents old cleanup from affecting new attachment)
  if (attachId !== undefined && attachId !== state.attachId) {
    return
  }
  cleanup()
  state.currentEnvironment = null
  state.onCommandCallback = null
  state.onInterruptCallback = null
}

export const updateTerminalTheme = (): void => {
  applyThemeToContainer()
}

export const getTerminalRenderer = (): TerminalRenderer | null => state.renderer

export const getCurrentTerminalEnvironment = (): EmulatedEnvironment | null =>
  state.currentEnvironment

export const syncTerminalPrompt = (): void => {
  if (state.currentEnvironment == null) {
    return
  }
  state.currentEnvironment.shellContextStack.updateCurrentPrompt()
  refreshPrompt()
}

export const lockTerminalInput = (): void => {
  state.inputLocked = true
  state.terminal?.disable()
}

export const unlockTerminalInput = (): void => {
  state.inputLocked = false
  state.terminal?.enable()
}

export const isTerminalInputLocked = (): boolean => state.inputLocked

export const focusTerminal = (): void => {
  if (state.terminal) {
    state.terminal.focus()
  }
}
