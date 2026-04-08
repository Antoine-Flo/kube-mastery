import type { FileSystem } from '../../filesystem/FileSystem'
import type { ExecutionResult } from '../../shared/result'
import {
  createShellExecutor,
  type EditorModal,
  type ShellRuntimeOptions
} from './index'
import { executeSequentialShellScript } from './shellScriptRunner'

export interface ShellExecutionContext {
  fileSystem: FileSystem
  editorModal?: EditorModal
  runtimeOptions?: ShellRuntimeOptions
}

export const createShellExecutorFromContext = (
  context: ShellExecutionContext
) => {
  return createShellExecutor(
    context.fileSystem,
    context.editorModal,
    context.runtimeOptions ?? {}
  )
}

export const executeShellScriptFromContext = (
  context: ShellExecutionContext,
  script: string
): ExecutionResult => {
  const shellExecutor = createShellExecutorFromContext(context)
  return executeSequentialShellScript(shellExecutor, script)
}
