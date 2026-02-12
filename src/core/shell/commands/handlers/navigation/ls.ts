// ═══════════════════════════════════════════════════════════════════════════
// LS COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Lists directory contents with optional detailed view (-l flag).

import type { FileSystem } from '../../../../filesystem/FileSystem'
import {
  formatColumns,
  formatLongListing,
  type FileEntry
} from '../../../../shared/formatter'
import type { ExecutionResult } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

export const createLsHandler = (
  fileSystem: FileSystem
): ShellCommandHandler => {
  return {
    execute: (
      args: string[],
      flags: Record<string, boolean | string>
    ): ExecutionResult => {
      // Determine target paths (all args or flag value, or current directory)
      const targetPaths: (string | undefined)[] = []

      if (typeof flags.l === 'string') {
        // -l flag with value
        targetPaths.push(flags.l)
      } else if (args.length > 0) {
        // Use all args (realistic shell behavior)
        targetPaths.push(...args)
      } else {
        // No args: list current directory
        targetPaths.push(undefined)
      }

      // List all specified paths (realistic shell behavior)
      const allEntries: FileEntry[] = []
      const allNames: string[] = []
      const now = new Date().toISOString()

      for (const targetPath of targetPaths) {
        const result = fileSystem.listDirectory(targetPath)
        if (!result.ok) {
          return error(result.error)
        }

        const nodes = result.value

        if (flags.l) {
          // Detailed listing (-l flag)
          const entries: FileEntry[] = nodes.map((node) => ({
            type: node.type,
            name: node.name,
            size: node.type === 'file' ? node.content?.length || 0 : 512,
            modified: node.type === 'file' ? node.modifiedAt || now : now
          }))
          allEntries.push(...entries)
        } else {
          // Simple listing (just names)
          const names = nodes.map((node) => node.name)
          allNames.push(...names)
        }
      }

      // Format output (TerminalOutput.writeOutput gère les sauts de ligne)
      if (flags.l) {
        return success(formatLongListing(allEntries))
      } else {
        return success(formatColumns(allNames))
      }
    }
  }
}
