// ═══════════════════════════════════════════════════════════════════════════
// PWD COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Prints the current working directory.

import type { FileSystem } from '../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../shared/result'
import { success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

export const createPwdHandler = (fileSystem: FileSystem): ShellCommandHandler => {
    return {
        execute: (): ExecutionResult => {
            const currentPath = fileSystem.getCurrentPath()
            return success(currentPath)
        }
    }
}
