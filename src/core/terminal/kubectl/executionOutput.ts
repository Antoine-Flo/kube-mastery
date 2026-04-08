import type { ExecutionResult } from '../../shared/result'
import type { CommandContext } from '../core/CommandContext'

export const restorePromptAfterStreamStop = (
  context: CommandContext
): void => {
  context.output.showCursor()
  context.renderer.write(context.shellContextStack.getCurrentPrompt())
  context.renderer.focus()
}

export const writeExecutionResultOutput = (
  context: CommandContext,
  result: ExecutionResult
): void => {
  const stdout = result.io?.stdout
  if (stdout != null && stdout.length > 0) {
    context.output.writeOutput(stdout)
  }
  if (result.ok) {
    const value = result.value
    if (value.length === 0) {
      return
    }
    if (stdout != null && value === stdout) {
      return
    }
    context.output.writeOutput(value)
    return
  }

  const stderr = result.io?.stderr ?? result.error
  if (stderr.length > 0) {
    context.output.writeOutput(stderr)
  }
}
