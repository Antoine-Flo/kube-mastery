// ═══════════════════════════════════════════════════════════════════════════
// CODEMIRROR EDITOR
// ═══════════════════════════════════════════════════════════════════════════
// Factory for a CodeMirror-based editor. Supports multiple languages via filename.

import { EditorState } from '@codemirror/state'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { defaultKeymap, indentWithTab } from '@codemirror/commands'
import { yaml } from '@codemirror/lang-yaml'
import { oneDark } from '@codemirror/theme-one-dark'
import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'

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
  onSave?: () => void
  theme?: 'dark' | 'light'
  filename?: string
}

// ═══════════════════════════════════════════════════════════════════════════
// LANGUAGE DETECTION
// ═══════════════════════════════════════════════════════════════════════════

const detectLanguage = (filename: string) => {
  const ext = filename.split('.').pop()?.toLowerCase()

  switch (ext) {
    case 'yaml':
    case 'yml':
      return yaml()
    default:
      return []
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// THEME
// ═══════════════════════════════════════════════════════════════════════════

const lightTheme = EditorView.theme({
  '&': {
    backgroundColor: '#fcfcfc',
    color: '#333'
  },
  '.cm-content': {
    caretColor: '#333'
  },
  '.cm-cursor': {
    borderLeftColor: '#333'
  },
  '.cm-gutters': {
    backgroundColor: '#f5f5f5',
    color: '#999',
    borderRight: '1px solid #ddd'
  },
  '.cm-activeLineGutter': {
    backgroundColor: '#e8e8e8'
  },
  '.cm-activeLine': {
    backgroundColor: '#f0f0f0'
  }
})

const getThemeExtension = (theme: 'dark' | 'light') => {
  if (theme === 'dark') {
    return oneDark
  }
  return [lightTheme, syntaxHighlighting(defaultHighlightStyle)]
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
    const languageExtension = options.filename
      ? detectLanguage(options.filename)
      : []

    return [
      EditorView.theme({
        '&': {
          height: '100%',
          minHeight: '0',
          // fontSize: '1rem',
          lineHeight: '1.6'
        },
        '.cm-scroller': {
          overflow: 'auto',
          minHeight: '0'
        },
        '.cm-gutters': {
          fontSize: '1rem'
        }
      }),
      lineNumbers(),
      languageExtension,
      getThemeExtension(currentTheme),
      keymap.of([
        ...defaultKeymap,
        indentWithTab,
        {
          key: 'Ctrl-s',
          run: () => {
            if (options.onSave) {
              options.onSave()
            }
            return true
          }
        },
        {
          key: 'Mod-s',
          run: () => {
            if (options.onSave) {
              options.onSave()
            }
            return true
          }
        }
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
