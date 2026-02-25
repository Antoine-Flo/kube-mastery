import type { ExecutionResult } from '../../../../shared/result'
import { success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

export interface ExitHandlerOptions {
  onExit?: () => ExecutionResult
}

export const createExitHandler = (
  options: ExitHandlerOptions = {}
): ShellCommandHandler => {
  return {
    execute: (): ExecutionResult => {
      if (options.onExit != null) {
        return options.onExit()
      }
      return success('')
    }
  }
}
