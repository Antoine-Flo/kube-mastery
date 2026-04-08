import {
  createFileSystem,
  type FileSystemState
} from '../../filesystem/FileSystem'
import { error, success, type Result } from '../../shared/result'
import { executeShellScriptFromContext } from '../../shell/commands/executionContext'
import type { Container } from '../ressources/Pod'

const isShellBinary = (value: string): boolean => {
  return (
    value === 'sh' ||
    value === '/bin/sh' ||
    value === 'bash' ||
    value === '/bin/bash'
  )
}

const normalizeContainerCommandToScript = (
  container: Container
): Result<string | null> => {
  const command = container.command ?? []
  const args = container.args ?? []
  if (command.length === 0 && args.length === 0) {
    return success(null)
  }
  if (command.length > 0 && isShellBinary(command[0]) && args[0] === '-c') {
    const scriptBody = args.slice(1).join(' ').trim()
    if (scriptBody.length === 0) {
      return error('Invalid sh -c syntax')
    }
    return success(scriptBody)
  }

  const argv = command.length > 0 ? [...command, ...args] : [...args]
  const script = argv.join(' ').trim()
  if (script.length === 0) {
    return success(null)
  }
  return success(script)
}

export const executeInitContainer = (
  container: Container,
  filesystem: FileSystemState
): Result<FileSystemState> => {
  const scriptResult = normalizeContainerCommandToScript(container)
  if (!scriptResult.ok) {
    return scriptResult
  }
  const script = scriptResult.value
  if (script == null) {
    return success(filesystem)
  }
  const fs = createFileSystem(filesystem)
  const executeResult = executeShellScriptFromContext(
    {
      fileSystem: fs
    },
    script
  )
  if (!executeResult.ok) {
    return error(executeResult.error)
  }
  return success(fs.toJSON())
}
