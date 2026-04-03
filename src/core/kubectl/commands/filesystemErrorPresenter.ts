import type { FileSystemError } from '../../filesystem/errors'

export const formatKubectlPathDoesNotExistError = (path: string): string => {
  return `error: the path "${path}" does not exist`
}

export const formatKubectlFileSystemError = (
  fsError: FileSystemError,
  fallbackPath?: string
): string => {
  const path = fallbackPath ?? fsError.path

  if (fsError.code === 'NOT_FOUND' && path != null) {
    return formatKubectlPathDoesNotExistError(path)
  }

  if (fsError.code === 'NOT_A_DIRECTORY' && path != null) {
    return `error: ${path} is not a directory`
  }

  if (fsError.code === 'IS_A_DIRECTORY' && path != null) {
    return `error: ${path} is a directory`
  }

  if (fsError.code === 'READ_ONLY') {
    return 'error: read-only file system'
  }

  if (path != null) {
    return `error: failed to access "${path}"`
  }

  return 'error: filesystem operation failed'
}
