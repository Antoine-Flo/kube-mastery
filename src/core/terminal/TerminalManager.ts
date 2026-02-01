// ═══════════════════════════════════════════════════════════════════════════
// TERMINAL MANAGER
// ═══════════════════════════════════════════════════════════════════════════
// Gère le cycle de vie du terminal xterm.js avec protection contre les race conditions

import { FitAddon } from '@xterm/addon-fit';
import { Terminal as XTermTerminal, type IDisposable } from '@xterm/xterm';
import type { EmulatedEnvironment } from '../emulatedEnvironment/EmulatedEnvironment';
import { createDefaultAutocompleteEngine } from './autocomplete';
import { createTerminalController, type TerminalController } from './core/TerminalController';
import { createXTermRenderer } from './renderer/XTermRenderer';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TerminalManagerOptions {
  theme: () => 'dark' | 'light';
  rows?: number;
  scrollback?: number;
}

export interface AttachOptions {
  container: HTMLElement;
  environment: EmulatedEnvironment;
  /** Optional text written at top when terminal loads (e.g. home banner). Omitted = none. */
  topPrompt?: string;
  onCommand?: (command: string) => void;
}

// ═══════════════════════════════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════════════════════════════

interface TerminalManagerState {
  terminal: XTermTerminal | null;
  renderer: ReturnType<typeof createXTermRenderer> | null;
  controller: TerminalController | null;
  currentEnvironment: EmulatedEnvironment | null;
  dataDisposable: IDisposable | null;
  keyHandlerDisposable: IDisposable | null;
  resizeObserver: ResizeObserver | null;
  fitAddon: FitAddon | null;
  options: TerminalManagerOptions | null;
  onCommandCallback: ((command: string) => void) | null;
  attachId: number;
  debugCleanup: (() => void) | null;
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
  attachId: 0,
  debugCleanup: null,
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const getThemeColors = (theme: 'dark' | 'light') => ({
  background: theme === 'dark' ? '#111113' : '#fcfcfc',
  foreground: theme === 'dark' ? '#b4b4b4' : '#1a1a1a',
  cursor: theme === 'dark' ? '#b4b4b4' : '#1a1a1a',
});

const cleanup = () => {
  if (state.resizeObserver) {
    state.resizeObserver.disconnect();
    state.resizeObserver = null;
  }
  if (state.fitAddon) {
    state.fitAddon.dispose();
    state.fitAddon = null;
  }
  if (state.dataDisposable) {
    state.dataDisposable.dispose();
    state.dataDisposable = null;
  }
  if (state.keyHandlerDisposable) {
    state.keyHandlerDisposable.dispose();
    state.keyHandlerDisposable = null;
  }
  if (state.controller) {
    state.controller.dispose();
    state.controller = null;
  }
  if (state.debugCleanup) {
    state.debugCleanup();
    state.debugCleanup = null;
  }
  if (state.terminal) {
    try { state.terminal.dispose(); } catch { /* ignore */ }
    state.terminal = null;
  }
  state.renderer = null;
};

const setupTerminal = (container: HTMLElement, topPrompt?: string) => {
  if (!state.options || !state.currentEnvironment) {
    return;
  }

  // Create terminal instance
  const colors = getThemeColors(state.options.theme());
  state.terminal = new XTermTerminal({
    cursorBlink: true,
    scrollback: state.options.scrollback ?? 1000,
    rows: state.options.rows ?? 30,
    theme: colors,
    fontSize: 15,
    lineHeight: 1.2,
  });

  state.renderer = createXTermRenderer(state.terminal);

  // Create and load FitAddon
  state.fitAddon = new FitAddon();
  state.terminal.loadAddon(state.fitAddon);

  // Open terminal in container
  state.terminal.open(container);

  // Debug: capture key + IME/composition so we can correlate with onData
  type KeyEv = { key: string; code: string; keyCode: number; isComposing: boolean; repeat: boolean };
  const lastKeyEvents: KeyEv[] = [];
  const maxKeyEvents = 5;
  let imeComposing = false;
  let lastCompositionEvent: 'start' | 'update' | 'end' | null = null;
  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);

  let debugSeq = 0;
  const dispatchDebug = (detail: {
    seq: number;
    data: string;
    dataLength: number;
    readable: string;
    codes: string;
    hex: string;
    lastKeyEvents: KeyEv[];
    imeComposing: boolean;
    lastCompositionEvent: 'start' | 'update' | 'end' | null;
    injected?: boolean;
    ignored?: boolean;
    ignoreReason?: string;
  }) => {
    if (typeof document !== 'undefined') {
      document.dispatchEvent(new CustomEvent('terminal-debug-input', { detail }));
    }
  };

  // Chrome Android / GBoard: use keydown + beforeinput as source of truth for Space/Enter/Backspace,
  // inject once in rAF and ignore IME onData (CodeMirror domobserver-style, see xtermjs/xterm.js#3600).
  let pendingKey: { char: string; time: number } | null = null;
  let pendingKeyTimeout: ReturnType<typeof setTimeout> | null = null;
  let pendingKeyRaf: number | null = null;
  let injectedKey: { char: string; time: number } | null = null;
  const ANDROID_KEY_MS = 180;
  const INJECTED_IGNORE_MS = 150;
  const textarea = state.terminal.textarea;
  const debugCleanups: (() => void)[] = [];

  const setPendingKey = (char: string) => {
    if (pendingKeyTimeout) {
      clearTimeout(pendingKeyTimeout);
    }
    pendingKey = { char, time: typeof performance !== 'undefined' ? performance.now() : 0 };
    pendingKeyTimeout = setTimeout(() => {
      pendingKey = null;
      pendingKeyTimeout = null;
    }, ANDROID_KEY_MS);
  };

  const scheduleInjectKey = () => {
    if (pendingKeyRaf !== null) {
      return;
    }
    pendingKeyRaf = requestAnimationFrame(() => {
      pendingKeyRaf = null;
      if (pendingKey === null) {
        return;
      }
      const char = pendingKey.char;
      pendingKey = null;
      if (pendingKeyTimeout) {
        clearTimeout(pendingKeyTimeout);
        pendingKeyTimeout = null;
      }
      const now = typeof performance !== 'undefined' ? performance.now() : 0;
      injectedKey = { char, time: now };
      lastData = char;
      lastDataTime = now;
      recentProcessed = (recentProcessed + char).slice(-RECENT_MAX);
      const readable =
        char === ' ' ? '·' : char === '\r' ? '↵' : char === '\x7f' ? 'BS' : char;
      const codes = char.split('').map((c) => c.charCodeAt(0)).join(', ');
      const hex = char.split('').map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
      dispatchDebug({
        seq: 0,
        data: char,
        dataLength: char.length,
        readable,
        codes,
        hex,
        lastKeyEvents: lastKeyEvents.slice(0),
        imeComposing,
        lastCompositionEvent,
        injected: true,
      });
      state.controller?.handleInput(char);
    });
  };

  if (textarea) {
    const onKeyDown = (e: KeyboardEvent) => {
      lastKeyEvents.unshift({
        key: e.key,
        code: e.code,
        keyCode: e.keyCode,
        isComposing: e.isComposing,
        repeat: e.repeat,
      });
      if (lastKeyEvents.length > maxKeyEvents) {
        lastKeyEvents.pop();
      }
      if (isMobile) {
        let char: string | null = null;
        if (e.key === ' ') {
          char = ' ';
        } else if (e.key === 'Enter') {
          char = '\r';
        } else if (e.key === 'Backspace' || e.keyCode === 8) {
          char = '\x7f';
        }
        if (char !== null) {
          setPendingKey(char);
          scheduleInjectKey();
        }
      }
    };
    const onBeforeInput = (e: InputEvent) => {
      if (!isMobile) {
        return;
      }
      let char: string | null = null;
      if (e.inputType === 'insertText' && e.data != null) {
        if (e.data === ' ') {
          char = ' ';
        }
        // Only Space is problematic as single-char insertText; other chars use normal path
      } else if (e.inputType === 'insertLineBreak' || e.inputType === 'insertParagraph') {
        char = '\r';
      } else if (e.inputType === 'deleteContentBackward') {
        char = '\x7f';
      }
      if (char !== null) {
        setPendingKey(char);
        scheduleInjectKey();
      }
    };
    const onCompStart = () => { imeComposing = true; lastCompositionEvent = 'start'; };
    const onCompUpdate = () => { lastCompositionEvent = 'update'; };
    const onCompEnd = () => { imeComposing = false; lastCompositionEvent = 'end'; };
    textarea.addEventListener('keydown', onKeyDown);
    textarea.addEventListener('beforeinput', onBeforeInput);
    textarea.addEventListener('compositionstart', onCompStart);
    textarea.addEventListener('compositionupdate', onCompUpdate);
    textarea.addEventListener('compositionend', onCompEnd);
    debugCleanups.push(
      () => textarea.removeEventListener('keydown', onKeyDown),
      () => textarea.removeEventListener('beforeinput', onBeforeInput),
      () => textarea.removeEventListener('compositionstart', onCompStart),
      () => textarea.removeEventListener('compositionupdate', onCompUpdate),
      () => textarea.removeEventListener('compositionend', onCompEnd),
    );
  }
  state.debugCleanup = () => {
    if (pendingKeyRaf !== null) {
      cancelAnimationFrame(pendingKeyRaf);
      pendingKeyRaf = null;
    }
    if (pendingKeyTimeout) {
      clearTimeout(pendingKeyTimeout);
      pendingKeyTimeout = null;
    }
    pendingKey = null;
    injectedKey = null;
    debugCleanups.forEach((f) => f());
  };

  // Fit terminal to container dimensions - use double RAF to ensure terminal is fully initialized
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (state.fitAddon && state.terminal) {
        try {
          state.fitAddon.fit();
        } catch (error) {
          throw new Error(`Failed to fit terminal: ${error}`);
        }
      }
    });
  });

  // Observe container size (e.g. terminal opened on mobile after being collapsed)
  let fitTimeout: ReturnType<typeof setTimeout> | null = null;
  state.resizeObserver = new ResizeObserver(() => {
    if (fitTimeout) {
      clearTimeout(fitTimeout);
    }
    fitTimeout = setTimeout(() => {
      if (state.fitAddon && state.terminal && container.offsetWidth > 0 && container.offsetHeight > 0) {
        try {
          state.fitAddon.fit();
        } catch { /* ignore */ }
      }
      fitTimeout = null;
    }, 50);
  });
  state.resizeObserver.observe(container);

  // Create controller
  state.controller = createTerminalController({
    renderer: state.renderer,
    shellContextStack: state.currentEnvironment.shellContextStack,
    autocompleteEngine: createDefaultAutocompleteEngine(),
  });

  // Connect command callback
  if (state.onCommandCallback) {
    state.controller.onCommand(state.onCommandCallback);
  }

  // Display optional top prompt + shell prompt
  state.terminal.clear();
  if (topPrompt) {
    state.renderer.write(topPrompt);
  }
  state.controller.showPrompt();

  // Mobile: intercept Space/Enter/Backspace on container (capture) so the key never reaches
  // the textarea → no onData from xterm → we inject once (avoids GBoard/IME duplication).
  if (isMobile && textarea) {
    const captureKeydown = (e: KeyboardEvent) => {
      if (e.target !== textarea) {
        return;
      }
      let char: string | null = null;
      if (e.key === ' ') {
        char = ' ';
      } else if (e.key === 'Enter') {
        char = '\r';
      } else if (e.key === 'Backspace' || e.keyCode === 8) {
        char = '\x7f';
      }
      if (char !== null) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const now = typeof performance !== 'undefined' ? performance.now() : 0;
        injectedKey = { char, time: now };
        lastData = char;
        lastDataTime = now;
        recentProcessed = (recentProcessed + char).slice(-RECENT_MAX);
        const readable =
          char === ' ' ? '·' : char === '\r' ? '↵' : char === '\x7f' ? 'BS' : char;
        const codes = char.split('').map((c) => c.charCodeAt(0)).join(', ');
        const hex = char.split('').map((c) => c.charCodeAt(0).toString(16).padStart(2, '0')).join(' ');
        dispatchDebug({
          seq: 0,
          data: char,
          dataLength: char.length,
          readable,
          codes,
          hex,
          lastKeyEvents: lastKeyEvents.slice(0),
          imeComposing,
          lastCompositionEvent,
          injected: true,
        });
        state.controller?.handleInput(char);
      }
    };
    container.addEventListener('keydown', captureKeydown, true);
    debugCleanups.push(() => container.removeEventListener('keydown', captureKeydown, true));
  }

  let lastData = '';
  let lastDataTime = 0;
  const DEDUP_MS = 120;
  const RECENT_MAX = 30;
  let recentProcessed = '';
  state.dataDisposable = state.terminal.onData((data: string) => {
    debugSeq += 1;
    const now = typeof performance !== 'undefined' ? performance.now() : 0;
    const readable = data.replace(/\x1b/g, 'ESC').replace(/ /g, '·');
    const codesArr = data.split('').map((c) => c.charCodeAt(0));
    const codesStr = codesArr.join(', ');
    const hexStr = codesArr.map((n) => n.toString(16).padStart(2, '0')).join(' ');

    let ignored = false;
    let ignoreReason: string | undefined;
    if (isMobile && data === '') {
      ignored = true;
      ignoreReason = 'empty';
    } else if (isMobile && injectedKey !== null && data === injectedKey.char && now - injectedKey.time < INJECTED_IGNORE_MS) {
      ignored = true;
      ignoreReason = 'injectedKey';
    } else if (isMobile && pendingKey !== null && now - pendingKey.time < ANDROID_KEY_MS) {
      ignored = true;
      ignoreReason = 'pendingKey';
    } else if (isMobile && data.length === 1 && data === lastData && now - lastDataTime < DEDUP_MS) {
      ignored = true;
      ignoreReason = 'dedup';
    } else if (isMobile && data.length > 1 && now - lastDataTime < 400) {
      // IME commit re-sends what we already typed (mot ou lettres). On ignore si la fin de
      // recentProcessed (sans espaces finaux, ex. espace injecté) contient déjà ce commit.
      const trimmed = recentProcessed.replace(/\s+$/, '');
      if (trimmed.endsWith(data)) {
        ignored = true;
        ignoreReason = 'commit';
      } else if (
        data.length > 1 &&
        data === data[0].repeat(data.length) &&
        trimmed.length >= data.length - 1 &&
        trimmed.endsWith(data.slice(0, -1))
      ) {
        // même lettre répétée : on a "aa", l'IME envoie "aaa" (espace injecté entre les deux)
        ignored = true;
        ignoreReason = 'commit';
      }
    }

    dispatchDebug({
      seq: debugSeq,
      data,
      dataLength: data.length,
      readable,
      codes: codesStr,
      hex: hexStr,
      lastKeyEvents: lastKeyEvents.slice(0),
      imeComposing,
      lastCompositionEvent,
      ...(ignored && { ignored: true, ignoreReason }),
    });

    if (ignored) {
      if (ignoreReason === 'dedup') {
        lastData = data;
        lastDataTime = now;
      }
      return;
    }
    lastData = data;
    lastDataTime = now;
    recentProcessed = (recentProcessed + data).slice(-RECENT_MAX);
    state.controller?.handleInput(data);
  });

  // Handle Ctrl+C: copy if selection, else cancel input and new prompt
  state.terminal.attachCustomKeyEventHandler((event: KeyboardEvent) => {
    if (event.ctrlKey && event.key === 'c' && event.type === 'keydown') {
      const selection = state.terminal?.getSelection();
      if (selection) {
        navigator.clipboard.writeText(selection);
        return false;
      }
      state.controller?.cancelInput();
      return false;
    }
    return true;
  });

  state.terminal.focus();
};

const createResizeObserver = (container: HTMLElement, expectedAttachId: number) => {
  // Only observe window resize, not container resize (to avoid infinite loop)
  let resizeTimeout: number | null = null;

  const handleWindowResize = () => {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }

    resizeTimeout = window.setTimeout(() => {
      if (state.attachId === expectedAttachId && state.fitAddon) {
        state.fitAddon.fit();
      }
    }, 150);
  };

  window.addEventListener('resize', handleWindowResize);

  // Store cleanup function
  (container as any).__terminalResizeCleanup = () => {
    if (resizeTimeout) {
      clearTimeout(resizeTimeout);
    }
    window.removeEventListener('resize', handleWindowResize);
  };
};

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

export const initTerminalManager = (options: TerminalManagerOptions): void => {
  state.options = options;
};

export const attachTerminal = (options: AttachOptions): number => {
  const { container, environment, topPrompt, onCommand } = options;

  // Increment attach ID to track this attachment
  state.attachId++;
  const currentAttachId = state.attachId;

  if (!state.options) {
    console.error('[TerminalManager] Not initialized. Call initTerminalManager first.');
    return currentAttachId;
  }

  // Clean up any existing terminal before creating new one
  cleanup();

  // Store new context
  state.onCommandCallback = onCommand ?? null;
  state.currentEnvironment = environment;

  // Setup terminal - use RAF to ensure container is in DOM after render
  requestAnimationFrame(() => {
    // Verify attachment is still valid (prevents race conditions)
    if (state.attachId !== currentAttachId) {
      return;
    }

    // Container already has dimensions, setup terminal immediately
    setupTerminal(container, topPrompt);
    // Create ResizeObserver to handle future resizes
    createResizeObserver(container, currentAttachId);

  });

  return currentAttachId;
};

export const detachTerminal = (attachId?: number): void => {
  // Skip if attachId doesn't match (prevents old cleanup from affecting new attachment)
  if (attachId !== undefined && attachId !== state.attachId) {
    return;
  }
  cleanup();
  state.currentEnvironment = null;
  state.onCommandCallback = null;
};

export const updateTerminalTheme = (): void => {
  if (!state.terminal || !state.options) {
    return;
  }
  state.terminal.options.theme = getThemeColors(state.options.theme());
};

export const getTerminalController = (): TerminalController | null => state.controller;

export const focusTerminal = (): void => {
  if (state.terminal) {
    state.terminal.focus();
  }
};
