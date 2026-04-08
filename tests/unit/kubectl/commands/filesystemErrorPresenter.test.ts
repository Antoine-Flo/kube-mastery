import { describe, expect, it } from 'vitest'
import type { FileSystemError } from '~/core/filesystem/errors'
import {
  formatKubectlFileSystemError,
  formatKubectlPathDoesNotExistError
} from '~/core/kubectl/commands/filesystemErrorPresenter'

const createFsError = (
  code: FileSystemError['code'],
  path?: string
): FileSystemError => {
  return {
    code,
    operation: 'readFile',
    path,
    message: 'fs error'
  }
}

describe('filesystemErrorPresenter', () => {
  it('formats explicit path not found message', () => {
    expect(formatKubectlPathDoesNotExistError('/tmp/a.yaml')).toBe(
      'error: the path "/tmp/a.yaml" does not exist'
    )
  })

  it('formats NOT_FOUND with fallback path', () => {
    const message = formatKubectlFileSystemError(
      createFsError('NOT_FOUND', '/tmp/ignored'),
      '/tmp/actual'
    )
    expect(message).toBe('error: the path "/tmp/actual" does not exist')
  })

  it('formats NOT_A_DIRECTORY and IS_A_DIRECTORY errors', () => {
    const notDirectory = formatKubectlFileSystemError(
      createFsError('NOT_A_DIRECTORY', '/tmp/file.txt')
    )
    expect(notDirectory).toBe('error: /tmp/file.txt is not a directory')

    const isDirectory = formatKubectlFileSystemError(
      createFsError('IS_A_DIRECTORY', '/tmp/dir')
    )
    expect(isDirectory).toBe('error: /tmp/dir is a directory')
  })

  it('formats READ_ONLY error', () => {
    const message = formatKubectlFileSystemError(createFsError('READ_ONLY'))
    expect(message).toBe('error: read-only file system')
  })

  it('falls back to generic path and generic unknown message', () => {
    const withPath = formatKubectlFileSystemError(
      createFsError('UNKNOWN', '/tmp/data')
    )
    expect(withPath).toBe('error: failed to access "/tmp/data"')

    const withoutPath = formatKubectlFileSystemError(createFsError('UNKNOWN'))
    expect(withoutPath).toBe('error: filesystem operation failed')
  })
})
