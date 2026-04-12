import type { KubectlExecutorOptions } from '../../kubectl/commands/executor'
import type { CommandContext } from '../core/CommandContext'

export const KUBECTL_EDIT_TMP_DIR = '/tmp'

export const buildKubectlExecutorTerminalOptions = (
  context: CommandContext
): KubectlExecutorOptions => {
  return {
    metricsProvider: context.metricsProvider,
    editorModal: context.editorModal,

    onAsyncOutput: (message: string) => {
      if (message.length === 0) {
        return
      }
      // Async editor save happens after prompt is already rendered.
      // Replace current prompt line to avoid inserting an extra blank line.
      context.output.write('\r')
      context.renderer.clearLine()
      context.output.writeOutput(message)
      context.output.write(context.shellContextStack.getCurrentPrompt())
    },

    preserveFailedEditCopy: (content: string) => {
      const createTmpDirectoryResult = context.fileSystem.createDirectory(
        KUBECTL_EDIT_TMP_DIR,
        true
      )
      if (
        !createTmpDirectoryResult.ok &&
        !createTmpDirectoryResult.error.includes('File exists')
      ) {
        return undefined
      }
      const uniqueId = Math.floor(Math.random() * 10000000000)
      const copyPath = `${KUBECTL_EDIT_TMP_DIR}/kubectl-edit-${uniqueId}.yaml`
      const writeCopyResult = context.fileSystem.writeFile(copyPath, content)
      if (!writeCopyResult.ok) {
        return undefined
      }
      return copyPath
    }
  }
}
