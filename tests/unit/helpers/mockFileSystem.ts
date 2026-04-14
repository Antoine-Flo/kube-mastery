// ═══════════════════════════════════════════════════════════════════════════
// MOCK FILESYSTEM UTILITIES
// ═══════════════════════════════════════════════════════════════════════════
// Utilities for creating mock FileSystem instances in tests

import { success } from '../../../src/core/shared/result'
import type { FileSystem } from '../../../src/core/filesystem/FileSystem'
import { toFileSystemResult } from '../../../src/core/filesystem/errors'
import {
  createFile as createFileNode,
  createDirectory
} from '../../../src/core/filesystem/models'
import type {
  AutocompleteClusterState,
  AutocompleteContext
} from '../../../src/core/terminal/autocomplete/types'

/**
 * Full FileSystem-shaped stub for tests. When `AutocompleteContext.fileSystem`
 * or similar requires every method, use this (or `createAutocompleteTestContext`)
 * instead of inline partials.
 */
export const createMockFileSystem = (
  overrides: Partial<FileSystem> = {}
): FileSystem => {
  const listDirectory = overrides.listDirectory ?? (() => success([]))
  const createDirectoryFn = overrides.createDirectory ?? (() => success(''))
  const deleteDirectoryFn =
    overrides.deleteDirectory ?? (() => success(undefined))
  const createFileFn =
    overrides.createFile ??
    (() => success(createFileNode('test', '/home/kube/test')))
  const readFile = overrides.readFile ?? (() => success(''))
  const readFiles =
    overrides.readFiles ?? ((paths: string[]) => success(paths.map(() => '')))
  const writeFile = overrides.writeFile ?? (() => success(undefined))
  const deleteFile = overrides.deleteFile ?? (() => success(undefined))
  const movePath = overrides.movePath ?? (() => success(undefined))

  return {
    getCurrentPath: overrides.getCurrentPath ?? (() => '/home/kube'),
    changeDirectory: overrides.changeDirectory ?? (() => success('')),
    listDirectory,
    listDirectoryDetailed: (path?: string) => {
      return toFileSystemResult(listDirectory(path), 'listDirectory', path)
    },
    createDirectory: createDirectoryFn,
    deleteDirectory: deleteDirectoryFn,
    createFile: createFileFn,
    readFile,
    readFileDetailed: (path: string) => {
      return toFileSystemResult(readFile(path), 'readFile', path)
    },
    readFiles,
    readFilesDetailed: (paths: string[]) => {
      return toFileSystemResult(readFiles(paths), 'readFiles')
    },
    writeFile,
    writeFileDetailed: (path: string, content: string) => {
      return toFileSystemResult(writeFile(path, content), 'writeFile', path)
    },
    deleteFile,
    movePath,
    movePathDetailed: (sourcePath: string, destinationPath: string) => {
      return toFileSystemResult(
        movePath(sourcePath, destinationPath),
        'movePath',
        `${sourcePath} -> ${destinationPath}`
      )
    },
    toJSON:
      overrides.toJSON ??
      (() => ({
        currentPath: '/home/kube',
        tree: createDirectory('root', '/')
      })),
    loadState: overrides.loadState ?? (() => {})
  }
}

/**
 * Default AutocompleteContext for unit tests: empty cluster snapshot and a
 * FileSystem stub from `createMockFileSystem`. Keeps autocomplete tests aligned
 * when `AutocompleteContext` or `FileSystem` evolve.
 */
export const createAutocompleteTestContext = (options?: {
  clusterState?: AutocompleteClusterState
  fileSystemOverrides?: Partial<FileSystem>
}): AutocompleteContext => ({
  clusterState: options?.clusterState ?? {},
  fileSystem: createMockFileSystem(options?.fileSystemOverrides ?? {})
})
