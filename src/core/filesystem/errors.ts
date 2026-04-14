import type { Result } from '../shared/result'

export type FileSystemOperation =
  | 'changeDirectory'
  | 'listDirectory'
  | 'createDirectory'
  | 'deleteDirectory'
  | 'createFile'
  | 'readFile'
  | 'readFiles'
  | 'writeFile'
  | 'deleteFile'
  | 'movePath'

export type FileSystemErrorCode =
  | 'NOT_FOUND'
  | 'NOT_A_DIRECTORY'
  | 'IS_A_DIRECTORY'
  | 'READ_ONLY'
  | 'INVALID_ARGUMENT'
  | 'ALREADY_EXISTS'
  | 'DIRECTORY_NOT_EMPTY'
  | 'UNKNOWN'

export interface FileSystemError {
  code: FileSystemErrorCode
  operation: FileSystemOperation
  path?: string
  message: string
}

export type FileSystemResult<T> = Result<T, FileSystemError>

const resolveCodeFromMessage = (message: string): FileSystemErrorCode => {
  if (message.includes('No such file or directory')) {
    return 'NOT_FOUND'
  }
  if (message.includes('Not a directory')) {
    return 'NOT_A_DIRECTORY'
  }
  if (message.includes('Is a directory')) {
    return 'IS_A_DIRECTORY'
  }
  if (message.includes('Read-only file system')) {
    return 'READ_ONLY'
  }
  if (message.includes('Invalid argument')) {
    return 'INVALID_ARGUMENT'
  }
  if (message.includes('File exists')) {
    return 'ALREADY_EXISTS'
  }
  if (message.includes('Directory not empty')) {
    return 'DIRECTORY_NOT_EMPTY'
  }
  return 'UNKNOWN'
}

export const createFileSystemError = (
  operation: FileSystemOperation,
  path: string | undefined,
  message: string
): FileSystemError => {
  return {
    code: resolveCodeFromMessage(message),
    operation,
    path,
    message
  }
}

export const toFileSystemResult = <T>(
  result: Result<T>,
  operation: FileSystemOperation,
  path?: string
): FileSystemResult<T> => {
  if (result.ok) {
    return {
      ok: true,
      value: result.value
    }
  }
  return {
    ok: false,
    error: createFileSystemError(operation, path, result.error)
  }
}
