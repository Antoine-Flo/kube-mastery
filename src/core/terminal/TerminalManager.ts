// ═══════════════════════════════════════════════════════════════════════════
// TERMINAL MANAGER
// ═══════════════════════════════════════════════════════════════════════════
// Gère le cycle de vie du terminal jQuery Terminal avec protection race conditions.

import $ from 'jquery'
import installJQueryTerminal from 'jquery.terminal'
import installUnixFormatting from 'jquery.terminal/js/unix_formatting'
import type { EmulatedEnvironment } from '../emulatedEnvironment/EmulatedEnvironment'
import { createDefaultAutocompleteEngine } from './autocomplete'
import type { AutocompleteContext } from './autocomplete/types'
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
const autocompleteEngine = createDefaultAutocompleteEngine()
const CTRL_C_OUTPUT = '^C\r\n'

type CtrlCAction = 'copy-selection' | 'interrupt' | 'cancel-command' | 'noop'

const isCtrlCKeydown = (event: KeyboardEvent): boolean => {
  return (
    event.ctrlKey &&
    event.key.toLowerCase() === 'c' &&
    event.type === 'keydown'
  )
}

const handleCtrlC = (terminal: JQueryTerminalInstance): boolean => {
  const selectedText = window.getSelection()?.toString() ?? ''
  const interruptHandled = state.onInterruptCallback?.() === true
  const currentCommand = terminal.get_command?.() ?? ''
  const action = resolveCtrlCAction({
    selectedText,
    currentCommand,
    interruptHandled
  })
  if (action === 'copy-selection') {
    return true
  }
  if (action === 'interrupt' || action === 'cancel-command') {
    state.renderer?.write(CTRL_C_OUTPUT)
    terminal.set_command('')
    refreshPrompt()
  }
  return false
}

export const resolveCtrlCAction = (params: {
  selectedText: string
  currentCommand: string
  interruptHandled: boolean
}): CtrlCAction => {
  if (params.selectedText.length > 0) {
    return 'copy-selection'
  }
  if (params.interruptHandled) {
    return 'interrupt'
  }
  if (params.currentCommand.trim().length > 0) {
    return 'cancel-command'
  }
  return 'noop'
}

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

const buildAutocompleteContext = (): AutocompleteContext | null => {
  if (state.currentEnvironment == null) {
    return null
  }
  const environment = state.currentEnvironment
  return {
    clusterState: {
      getPods: (namespace?: string) =>
        environment.apiServer.listResources('Pod', namespace),
      getConfigMaps: (namespace?: string) =>
        environment.apiServer.listResources('ConfigMap', namespace),
      getSecrets: (namespace?: string) =>
        environment.apiServer.listResources('Secret', namespace),
      getNodes: () => environment.apiServer.listResources('Node'),
      getReplicaSets: (namespace?: string) =>
        environment.apiServer.listResources('ReplicaSet', namespace),
      getDaemonSets: (namespace?: string) =>
        environment.apiServer.listResources('DaemonSet', namespace),
      getStatefulSets: (namespace?: string) =>
        environment.apiServer.listResources('StatefulSet', namespace),
      getDeployments: (namespace?: string) =>
        environment.apiServer.listResources('Deployment', namespace),
      getLeases: (namespace?: string) =>
        environment.apiServer.listResources('Lease', namespace),
      getNetworkPolicies: (namespace?: string) =>
        environment.apiServer.listResources('NetworkPolicy', namespace),
      getNamespaces: () => environment.apiServer.listResources('Namespace')
    },
    fileSystem: environment.shellContextStack.getCurrentFileSystem()
  }
}

const buildCompletionCandidates = (command: string): string[] => {
  const context = buildAutocompleteContext()
  if (context == null) {
    return []
  }
  const suggestions = autocompleteEngine.getCompletions(command, context)
  return [...new Set(suggestions)].sort((left, right) =>
    left.localeCompare(right)
  )
}

const buildCompletionResults = (
  command: string
): Array<{ text: string; suffix: string }> => {
  const context = buildAutocompleteContext()
  if (context == null) {
    return []
  }
  const suggestions = autocompleteEngine.getCompletionResults(command, context)
  return suggestions.sort((left, right) => left.text.localeCompare(right.text))
}

const getCurrentToken = (line: string): string => {
  if (line.endsWith(' ')) {
    return ''
  }
  const lastSpace = line.lastIndexOf(' ')
  if (lastSpace === -1) {
    return line
  }
  return line.slice(lastSpace + 1)
}

const applySingleCompletion = (
  line: string,
  completion: { text: string; suffix: string }
): string => {
  const currentToken = getCurrentToken(line)
  const lineBeforeToken = line.slice(0, line.length - currentToken.length)
  const completedLine = `${lineBeforeToken}${completion.text}${completion.suffix}`
  if (line === completedLine) {
    return line
  }
  return completedLine
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
  if (state.inputLocked) {
    state.terminal.set_prompt('')
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
        const completionResults = buildCompletionResults(currentLine)
        if (completionResults.length === 1) {
          const nextLine = applySingleCompletion(currentLine, completionResults[0])
          this.set_command(nextLine)
          callback([])
          return
        }
        callback(buildCompletionCandidates(currentLine))
      },
      keydown: (event: KeyboardEvent): boolean => {
        if (state.inputLocked && !isCtrlCKeydown(event)) {
            return false
        }
        if (isCtrlCKeydown(event)) {
          return handleCtrlC(terminal)
        }
        return true
      },
      prompt: () => {
        if (state.inputLocked) {
          return ''
        }
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

  requestAnimationFrame(() => {
    if (state.terminal == null || state.container == null) {
      return
    }
    const h = Math.max(120, state.container.clientHeight)
    state.terminal.resize?.(state.container.clientWidth, h)
    state.terminal.scroll_to_bottom?.()
  })

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
  state.terminal?.set_command('')
  state.terminal?.set_prompt('')
}

export const unlockTerminalInput = (): void => {
  state.inputLocked = false
  refreshPrompt()
}

export const isTerminalInputLocked = (): boolean => state.inputLocked

export const focusTerminal = (): void => {
  if (state.terminal) {
    state.terminal.focus()
  }
}
