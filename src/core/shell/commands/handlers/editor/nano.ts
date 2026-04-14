// ═══════════════════════════════════════════════════════════════════════════
// NANO COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Opens the YAML editor modal for editing files.

import type { FileSystem } from '../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

export type EditorModal = {
  open: (
    filename: string,
    content: string,
    onSave: (newContent: string) => boolean | void,
    onCancel?: () => void
  ) => void
}

export const createNanoHandler = (
  fileSystem: FileSystem,
  editorModal?: EditorModal
): ShellCommandHandler => {
  return {
    execute: (args: string[]): ExecutionResult => {
      if (args.length === 0) {
        return error('nano: missing file operand')
      }

      if (!editorModal) {
        return error('Editor not available')
      }

      const filename = args[0]

      // Try to read existing file
      const readResult = fileSystem.readFile(filename)
      let content = ''

      if (readResult.ok) {
        content = readResult.value
      }

      // Open editor modal
      editorModal.open(filename, content, (newContent: string) => {
        // Save callback - create file if it doesn't exist
        if (!readResult.ok) {
          const createResult = fileSystem.createFile(filename)
          if (!createResult.ok) {
            return false
          }
        }

        const writeResult = fileSystem.writeFile(filename, newContent)
        if (!writeResult.ok) {
          return false
        }
        return true
      })

      // Return success immediately - modal handles UI
      return success('')
    }
  }
}
