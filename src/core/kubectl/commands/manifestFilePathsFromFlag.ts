// Shared -f / --filename resolution: single file or directory of manifest files.

import type { FileSystem } from '../../filesystem/FileSystem'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import { formatKubectlFileSystemError } from './filesystemErrorPresenter'

const MANIFEST_FILENAME_EXTENSIONS = [
  '.yaml',
  '.yml',
  '.json',
  '.kyaml'
] as const

export const NO_OBJECTS_PASSED_TO_APPLY = 'error: no objects passed to apply'

export const NO_OBJECTS_PASSED_TO_DELETE = 'error: no objects passed to delete'

const hasManifestFilenameExtension = (fileName: string): boolean => {
  const lower = fileName.toLowerCase()
  for (const ext of MANIFEST_FILENAME_EXTENSIONS) {
    if (lower.endsWith(ext)) {
      return true
    }
  }
  return false
}

const joinDirectoryAndFilename = (
  directoryPath: string,
  fileName: string
): string => {
  const trimmed = directoryPath.replace(/\/+$/, '')
  if (trimmed === '' || trimmed === '/') {
    return `/${fileName}`
  }
  return `${trimmed}/${fileName}`
}

/**
 * Resolve -f path to manifest file paths: one file, or sorted files in a directory (non-recursive).
 */
export const resolveManifestFilePathsFromFilenameFlag = (
  fileSystem: FileSystem,
  filename: string,
  noManifestFilesMessage: string
): Result<string[]> => {
  const listResult = fileSystem.listDirectoryDetailed(filename)
  if (listResult.ok) {
    const paths: string[] = []
    for (const child of listResult.value) {
      if (child.type !== 'file') {
        continue
      }
      const baseName = child.path.split('/').filter(Boolean).pop() || child.name
      if (!hasManifestFilenameExtension(baseName)) {
        continue
      }
      paths.push(joinDirectoryAndFilename(filename, baseName))
    }
    paths.sort((left, right) => left.localeCompare(right))
    if (paths.length === 0) {
      return error(noManifestFilesMessage)
    }
    return success(paths)
  }
  if (listResult.error.code === 'NOT_A_DIRECTORY') {
    return success([filename])
  }
  return error(formatKubectlFileSystemError(listResult.error, filename))
}
