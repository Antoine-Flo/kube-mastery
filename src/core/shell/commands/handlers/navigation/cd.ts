// ═══════════════════════════════════════════════════════════════════════════
// CD COMMAND HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Changes the current working directory.

import type { FileSystem } from '../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

export const createCdHandler = (fileSystem: FileSystem): ShellCommandHandler => {
    return {
        execute: (args: string[]): ExecutionResult => {
            if (args.length === 0) {
                // cd without args goes to home (realistic shell behavior)
                const result = fileSystem.changeDirectory('~')
                if (!result.ok) {
                    return error(result.error)
                }
                return success('')
            }

            const path = args[0]
            const result = fileSystem.changeDirectory(path)

            if (!result.ok) {
                return error(result.error)
            }

            return success('')
        }
    }
}
