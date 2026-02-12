// ═══════════════════════════════════════════════════════════════════════════
// TERMINAL MANAGER
// ═══════════════════════════════════════════════════════════════════════════
// Gère le cycle de vie du terminal xterm.js avec protection contre les race conditions

import { FitAddon } from '@xterm/addon-fit'
import { Terminal as XTermTerminal, type IDisposable } from '@xterm/xterm'
import type { EmulatedEnvironment } from '../emulatedEnvironment/EmulatedEnvironment'
import { createDefaultAutocompleteEngine } from './autocomplete'
import {
  createTerminalController,
  type TerminalController
} from './core/TerminalController'
import { createXTermRenderer } from './renderer/XTermRenderer'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TerminalManagerOptions {
  theme: () => 'dark' | 'light'
  rows?: number
  scrollback?: number
}

export interface AttachOptions {
  container: HTMLElement
  environment: EmulatedEnvironment
  /** Optional text written at top when terminal loads (e.g. home banner). Omitted = none. */
  topPrompt?: string
  onCommand?: (command: string) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

interface TerminalManagerState {
  terminal: XTermTerminal | null
  renderer: ReturnType<typeof createXTermRenderer> | null
  controller: TerminalController | null
  currentEnvironment: EmulatedEnvironment | null
  dataDisposable: IDisposable | null
  keyHandlerDisposable: IDisposable | null
  resizeObserver: ResizeObserver | null
  fitAddon: FitAddon | null
  options: TerminalManagerOptions | null
  onCommandCallback: ((command: string) => void) | null
  attachId: number
}

const state: TerminalManagerState = {
  terminal: null,
  renderer: null,
  controller: null,
  currentEnvironment: null,
  dataDisposable: null,
  keyHandlerDisposable: null,
  resizeObserver: null,
  fitAddon: null,
  options: null,
  onCommandCallback: null,
  attachId: 0
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const getThemeColors = (theme: 'dark' | 'light') => ({
  background: theme === 'dark' ? '#111113' : '#fcfcfc',
  foreground: theme === 'dark' ? '#b4b4b4' : '#1a1a1a',
  cursor: theme === 'dark' ? '#b4b4b4' : '#1a1a1a'
})

const cleanup = () => {
  if (state.resizeObserver) {
    state.resizeObserver.disconnect()
    state.resizeObserver = null
  }
  if (state.fitAddon) {
    state.fitAddon.dispose()
    state.fitAddon = null
  }
  if (state.dataDisposable) {
    state.dataDisposable.dispose()
    state.dataDisposable = null
  }
  if (state.keyHandlerDisposable) {
    state.keyHandlerDisposable.dispose()
    state.keyHandlerDisposable = null
  }
  if (state.controller) {
    state.controller.dispose()
    state.controller = null
  }
  if (state.terminal) {
    try {
      state.terminal.dispose()
    } catch {
      /* ignore */
    }
    state.terminal = null
  }
  state.renderer = null
}

const setupTerminal = (container: HTMLElement, topPrompt?: string) => {
  if (!state.options || !state.currentEnvironment) {
    return
  }

  // Create terminal instance
  const colors = getThemeColors(state.options.theme())
  state.terminal = new XTermTerminal({
    cursorBlink: true,
    scrollback: state.options.scrollback ?? 1000,
    rows: state.options.rows ?? 30,
    theme: colors,
    fontSize: 15,
    lineHeight: 1.2
  })

  state.renderer = createXTermRenderer(state.terminal)

  // Create and load FitAddon
  state.fitAddon = new FitAddon()
  state.terminal.loadAddon(state.fitAddon)

  // Open terminal in container
  state.terminal.open(container)

  // Fit terminal to container dimensions - use double RAF to ensure terminal is fully initialized
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (state.fitAddon && state.terminal) {
        try {
          state.fitAddon.fit()
        } catch (error) {
          throw new Error(`Failed to fit terminal: ${error}`)
        }
      }
    })
  })

  // Observe container size (e.g. terminal opened on mobile after being collapsed)
  let fitTimeout: ReturnType<typeof setTimeout> | null = null
  state.resizeObserver = new ResizeObserver(() => {
    if (fitTimeout) {
      clearTimeout(fitTimeout)
    }
    fitTimeout = setTimeout(() => {
      if (
        state.fitAddon &&
        state.terminal &&
        container.offsetWidth > 0 &&
        container.offsetHeight > 0
      ) {
        try {
          state.fitAddon.fit()
        } catch {
          /* ignore */
        }
      }
      fitTimeout = null
    }, 50)
  })
  state.resizeObserver.observe(container)

  // Create controller
  state.controller = createTerminalController({
    renderer: state.renderer,
    shellContextStack: state.currentEnvironment.shellContextStack,
    autocompleteEngine: createDefaultAutocompleteEngine()
  })

  // Connect command callback
  if (state.onCommandCallback) {
    state.controller.onCommand(state.onCommandCallback)
  }

  // Display optional top prompt + shell prompt
  state.terminal.clear()
  if (topPrompt) {
    state.renderer.write(topPrompt)
  }
  state.controller.showPrompt()

  state.dataDisposable = state.terminal.onData((data: string) => {
    state.controller?.handleInput(data)
  })

  // Handle Ctrl+C: copy if selection, else cancel input and new prompt
  state.terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
    if (event.ctrlKey && event.key === 'c' && event.type === 'keydown') {
      const selection = state.terminal?.getSelection()
      if (selection) {
        navigator.clipboard.writeText(selection)
        return false
      }
      state.controller?.cancelInput()
      return false
    }
    return true
  })

  state.terminal.focus()
}

const createResizeObserver = (
  container: HTMLElement,
  expectedAttachId: number
) => {
  // Only observe window resize, not container resize (to avoid infinite loop)
  let resizeTimeout: number | null = null

  const handleWindowResize = () => {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout)
    }

    resizeTimeout = window.setTimeout(() => {
      if (state.attachId === expectedAttachId && state.fitAddon) {
        state.fitAddon.fit()
      }
    }, 150)
  }

  window.addEventListener('resize', handleWindowResize)

  // Store cleanup function
  ;(container as any).__terminalResizeCleanup = () => {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout)
    }
    window.removeEventListener('resize', handleWindowResize)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

export const initTerminalManager = (options: TerminalManagerOptions): void => {
  state.options = options
}

export const attachTerminal = (options: AttachOptions): number => {
  const { container, environment, topPrompt, onCommand } = options

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
  state.currentEnvironment = environment

  // Setup terminal - use RAF to ensure container is in DOM after render
  requestAnimationFrame(() => {
    // Verify attachment is still valid (prevents race conditions)
    if (state.attachId !== currentAttachId) {
      return
    }

    // Container already has dimensions, setup terminal immediately
    setupTerminal(container, topPrompt)
    // Create ResizeObserver to handle future resizes
    createResizeObserver(container, currentAttachId)
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
}

export const updateTerminalTheme = (): void => {
  if (!state.terminal || !state.options) {
    return
  }
  state.terminal.options.theme = getThemeColors(state.options.theme())
}

export const getTerminalController = (): TerminalController | null =>
  state.controller

export const focusTerminal = (): void => {
  if (state.terminal) {
    state.terminal.focus()
  }
}
