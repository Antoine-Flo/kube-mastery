// ═══════════════════════════════════════════════════════════════════════════
// TOUCH COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Creates an empty file.

import type { FileSystem } from '../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

export const createTouchHandler = (fileSystem: FileSystem): ShellCommandHandler => {
    return {
        execute: (args: string[]): ExecutionResult => {
            if (args.length === 0) {
                return error('touch: missing file operand')
            }

            // Create all specified files (realistic shell behavior)
            for (const fileName of args) {
                const result = fileSystem.createFile(fileName)
                if (!result.ok) {
                    return error(result.error)
                }
            }

            return success('')
        }
    }
}
