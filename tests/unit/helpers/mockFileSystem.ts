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

/**
 * Create a minimal mock FileSystem with default implementations
 * All methods can be overridden via the overrides parameter
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
