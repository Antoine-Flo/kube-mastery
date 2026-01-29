// ═══════════════════════════════════════════════════════════════════════════
// MKDIR COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Creates a directory.

import type { FileSystem } from '../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

export const createMkdirHandler = (fileSystem: FileSystem): ShellCommandHandler => {
    return {
        execute: (args: string[], flags: Record<string, boolean | string>): ExecutionResult => {
            // Determine directories to create
            const dirsToCreate: string[] = []

            if (typeof flags.p === 'string') {
                // -p flag with value
                dirsToCreate.push(flags.p)
            } else {
                // Use all args (realistic shell behavior)
                dirsToCreate.push(...args)
            }

            if (dirsToCreate.length === 0) {
                return error('mkdir: missing operand')
            }

            // Create all specified directories (realistic shell behavior)
            for (const dirName of dirsToCreate) {
                const result = fileSystem.createDirectory(dirName)
                if (!result.ok) {
                    return error(result.error)
                }
            }

            return success('')
        }
    }
}
