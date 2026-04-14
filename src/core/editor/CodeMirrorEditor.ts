// ═══════════════════════════════════════════════════════════════════════════
// CODEMIRROR EDITOR
// ═══════════════════════════════════════════════════════════════════════════
// Factory for a CodeMirror-based editor. Supports multiple languages via filename.

import { EditorState } from '@codemirror/state'
import { EditorView, keymap } from '@codemirror/view'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface CodeMirrorEditor {
  mount: (container: HTMLElement) => void
  setValue: (content: string) => void
  getValue: () => string
  focus: () => void
  destroy: () => void
  onChange: (callback: (value: string) => void) => void
  updateTheme: (theme: 'dark' | 'light') => void
}

export interface CodeMirrorEditorOptions {
  onRequestWriteOut?: () => void
  onRequestExit?: () => void
  theme?: 'dark' | 'light'
  filename?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════════════════════

const darkTheme = EditorView.theme({
  '&': {
    backgroundColor: 'var(--color-gray-1)',
    color: '#b4b4b4'
  },
  '.cm-content': {
    caretColor: '#b4b4b4',
    padding: '1.6em 0.75rem 0.5rem'
  },
  '.cm-cursor': {
    borderLeftColor: '#b4b4b4'
  },
  '.cm-activeLine': {
    backgroundColor: 'var(--color-gray-2)'
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
    backgroundColor: 'var(--color-gray-4)'
  }
})

const lightTheme = EditorView.theme({
  '&': {
    backgroundColor: '#f8f8f2',
    color: '#1f2937'
  },
  '.cm-content': {
    caretColor: '#1f2937',
    padding: '1.6em 0.75rem 0.5rem'
  },
  '.cm-cursor': {
    borderLeftColor: '#1f2937'
  },
  '.cm-gutters': {
    backgroundColor: '#f3f4f6',
    color: '#6b7280',
    borderRight: '1px solid #d1d5db'
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#e5e7eb'
  },
  '.cm-activeLine': {
    backgroundColor: '#eef2ff'
  }
})

const getThemeExtension = (theme: 'dark' | 'light') => {
  if (theme === 'dark') {
    return darkTheme
  }
  return lightTheme
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Create a CodeMirror editor
 */
export const createCodeMirrorEditor = (
  options: CodeMirrorEditorOptions = {}
): CodeMirrorEditor => {
  let view: EditorView | null = null
  let changeCallback: ((value: string) => void) | null = null
  let currentTheme = options.theme ?? 'dark'

  const createExtensions = () => {
    return [
      EditorView.theme({
        '&': {
          height: '100%',
          minHeight: '0',
          fontSize: '0.95rem',
          lineHeight: '1.6'
        },
        '.cm-scroller': {
          overflow: 'auto',
          minHeight: '0'
        },
        '.cm-content': {
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
        }
      }),
      getThemeExtension(currentTheme),
      keymap.of([
        {
          key: 'Ctrl-o',
          run: () => {
            options.onRequestWriteOut?.()
            return true
          }
        },
        {
          key: 'Ctrl-x',
          run: () => {
            options.onRequestExit?.()
            return true
          }
        },
        {
          key: 'Ctrl-s',
          run: () => true
        },
        {
          key: 'Mod-s',
          run: () => true
        },
        ...defaultKeymap,
        indentWithTab,
      ]),
      EditorView.updateListener.of((update) => {
        if (update.docChanged && changeCallback) {
          changeCallback(update.state.doc.toString())
        }
      }),
      EditorView.lineWrapping
    ]
  }

  const createEditorState = (content: string) => {
    return EditorState.create({
      doc: content,
      extensions: createExtensions()
    })
  }

  const getView = (): EditorView => {
    if (!view) {
      throw new Error('Editor not mounted or already destroyed')
    }
    return view
  }

  return {
    mount: (container: HTMLElement) => {
      if (view) {
        view.destroy()
      }

      const state = createEditorState('')
      view = new EditorView({
        state,
        parent: container
      })
    },

    setValue: (content: string) => {
      const state = createEditorState(content)
      getView().setState(state)
    },

    getValue: () => getView().state.doc.toString(),

    focus: () => {
      getView().focus()
    },

    destroy: () => {
      if (view) {
        view.destroy()
        view = null
      }
    },

    onChange: (callback: (value: string) => void) => {
      changeCallback = callback
    },

    updateTheme: (theme: 'dark' | 'light') => {
      if (theme === currentTheme) {
        return
      }
      currentTheme = theme
      const v = getView()
      const content = v.state.doc.toString()
      const state = createEditorState(content)
      v.setState(state)
    }
  }
}
