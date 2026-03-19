// ═══════════════════════════════════════════════════════════════════════════
// MOCK FILESYSTEM UTILITIES
// ═══════════════════════════════════════════════════════════════════════════
// Utilities for creating mock FileSystem instances in tests

import { success } from '../../../src/core/shared/result'
import type { FileSystem } from '../../../src/core/filesystem/FileSystem'
import {
  createFile as createFileNode,
  createDirectory
} from '../../../src/core/filesystem/models'
import type { FileSystemState } from '../../../src/core/filesystem/FileSystem'
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
): FileSystem => ({
  getCurrentPath: () => '/home/kube',
  changeDirectory: () => success(''),
  listDirectory: () => success([]),
  createDirectory: () => success(''),
  deleteDirectory: () => success(undefined),
  createFile: () => success(createFileNode('test', '/home/kube/test')),
  readFile: () => success(''),
  readFiles: (paths: string[]) => success(paths.map(() => '')),
  writeFile: () => success(undefined),
  deleteFile: () => success(undefined),
  toJSON: (): FileSystemState => ({
    currentPath: '/home/kube',
    tree: createDirectory('root', '/')
  }),
  loadState: () => {},
  ...overrides
})

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
