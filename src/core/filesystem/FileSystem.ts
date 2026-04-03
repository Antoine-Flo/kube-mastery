import type { EventBus } from '../cluster/events/EventBus'
import type { Result } from '../shared/result'
import { error, success } from '../shared/result'
import {
  toFileSystemResult,
  type FileSystemResult
} from './errors'
import {
  createDirectory,
  createFile,
  type DirectoryNode,
  type FileNode,
  type FileSystemNode
} from './models'
import {
  createDirectoryChangedEvent,
  createDirectoryCreatedEvent,
  createDirectoryDeletedEvent,
  createFileCreatedEvent,
  createFileDeletedEvent,
  createFileModifiedEvent
} from './events/types'

// ╔═══════════════════════════════════════════════════════════════════════╗
// ║                      FILESYSTEM STATE MANAGEMENT                      ║
// ╚═══════════════════════════════════════════════════════════════════════╝
// Virtual filesystem with tree structure and closure-based state.
// Supports navigation, file/directory operations with max depth validation (3 levels).

export interface FileSystemState {
  currentPath: string
  tree: DirectoryNode
  readOnlyMountPaths?: Set<string>
}

// ─── Path Operations ─────────────────────────────────────────────────────

/**
 * Simulated login home for the kube user (matches env and default cwd).
 */
const SIMULATED_HOME_DIRECTORY = '/home/kube'

/**
 * Expand leading ~ to the simulated home directory (POSIX-style).
 * Only `~` and `~/...` are expanded, not `~otheruser`.
 */
const expandTildeInTargetPath = (targetPath: string): string => {
  if (targetPath === '~') {
    return SIMULATED_HOME_DIRECTORY
  }
  if (targetPath.startsWith('~/')) {
    return `${SIMULATED_HOME_DIRECTORY}/${targetPath.slice(2)}`
  }
  return targetPath
}

/**
 * Get directory name from a path (POSIX-compatible, works in browser)
 * Example: '/path/to/file' -> '/path/to', '/file' -> '/', '/' -> '/'
 */
const dirname = (path: string): string => {
  if (path === '/') {
    return '/'
  }
  const parts = path.split('/').filter((p) => p.length > 0)
  if (parts.length <= 1) {
    return '/'
  }
  return '/' + parts.slice(0, -1).join('/')
}

/**
 * Resolve relative or absolute paths
 * Supports '..' (parent) and '.' (current) navigation
 */
const resolvePath = (currentPath: string, targetPath: string): string => {
  const expandedTargetPath = expandTildeInTargetPath(targetPath)
  if (expandedTargetPath.startsWith('/')) {
    return normalizePath(expandedTargetPath)
  }

  const parts = currentPath.split('/').filter((p) => p.length > 0)
  const targetParts = expandedTargetPath.split('/').filter((p) => p.length > 0)

  for (const part of targetParts) {
    if (part === '..') {
      // Go up one level (cannot go above root)
      if (parts.length > 0) {
        parts.pop()
      }
    } else if (part !== '.') {
      parts.push(part)
    }
  }

  return '/' + parts.join('/')
}

const normalizePath = (path: string): string => {
  const parts = path.split('/').filter((p) => p.length > 0)
  return '/' + parts.join('/')
}

const isPathInsideMount = (path: string, mountPath: string): boolean => {
  if (mountPath === '/') {
    return true
  }
  if (path === mountPath) {
    return true
  }
  return path.startsWith(`${mountPath}/`)
}

const isWriteBlockedByReadOnlyMount = (
  state: FileSystemState,
  absolutePath: string
): boolean => {
  if (state.readOnlyMountPaths == null || state.readOnlyMountPaths.size === 0) {
    return false
  }
  const normalizedPath = normalizePath(absolutePath)
  for (const mountPath of state.readOnlyMountPaths) {
    if (isPathInsideMount(normalizedPath, mountPath)) {
      return true
    }
  }
  return false
}

const createReadOnlyError = (
  command: string,
  absolutePath: string,
  action: string
): Result<never> => {
  return error(
    `${command}: cannot ${action} '${absolutePath}': Read-only file system`
  )
}

/**
 * Validate filename against forbidden characters
 * Forbidden: spaces, *, ?, <, >, |
 */
const validateFilename = (name: string): boolean => {
  if (!name || name.length === 0) {
    return false
  }

  const forbidden = /[\s*?<>|]/
  return !forbidden.test(name)
}

// ─── Tree Operations ─────────────────────────────────────────────────────

/**
 * Find node in tree by absolute path
 * Returns undefined if not found
 */
const findNode = (
  tree: DirectoryNode,
  path: string
): FileSystemNode | undefined => {
  if (path === '/') {
    return tree
  }

  const parts = path.split('/').filter((p) => p.length > 0)
  let current: FileSystemNode = tree

  for (const part of parts) {
    if (current.type !== 'directory') {
      return undefined
    }

    const child = current.children.get(part)
    if (!child) {
      return undefined
    }

    current = child
  }

  return current
}

// ───────────────────────────────────────────────────────────────────────────
// Mutation
// ───────────────────────────────────────────────────────────────────────────

/**
 * Insert node into tree at path
 * Note: Currently mutates tree (not fully immutable)
 * TODO(Phase 2): Make truly immutable with structural sharing
 */
const insertNode = (
  tree: DirectoryNode,
  path: string,
  node: FileSystemNode
): DirectoryNode => {
  if (path === '/') {
    return tree
  }

  const parts = path.split('/').filter((p) => p.length > 0)
  const name = parts[parts.length - 1]
  const parentPath = '/' + parts.slice(0, -1).join('/')

  const parent = findNode(tree, parentPath)
  if (!parent || parent.type !== 'directory') {
    return tree
  }

  // Side effect: mutates parent.children Map
  parent.children.set(name, node)
  return tree
}

/**
 * Remove node from tree at path
 */
const removeNode = (tree: DirectoryNode, path: string): DirectoryNode => {
  if (path === '/') {
    return tree
  }

  const parts = path.split('/').filter((p) => p.length > 0)
  const name = parts[parts.length - 1]
  const parentPath = '/' + parts.slice(0, -1).join('/')

  const parent = findNode(tree, parentPath)
  if (!parent || parent.type !== 'directory') {
    return tree
  }

  parent.children.delete(name)
  return tree
}

/**
 * Create directories recursively (mkdir -p behavior)
 */
const createDirectoriesRecursive = (
  tree: DirectoryNode,
  absolutePath: string
): void => {
  const parts = absolutePath.split('/').filter((p) => p.length > 0)
  let currentPath = '/'

  for (const part of parts) {
    currentPath = currentPath === '/' ? `/${part}` : `${currentPath}/${part}`
    const node = findNode(tree, currentPath)

    if (!node) {
      const dir = createDirectory(part, currentPath)
      insertNode(tree, currentPath, dir)
    }
  }
}

/**
 * Create single directory (non-recursive)
 */
const createSingleDirectory = (
  tree: DirectoryNode,
  absolutePath: string
): Result<void> => {
  const parts = absolutePath.split('/').filter((p) => p.length > 0)
  const parentPath = '/' + parts.slice(0, -1).join('/')
  const parent = findNode(tree, parentPath)

  if (!parent || parent.type !== 'directory') {
    return error(
      `mkdir: cannot create directory '${absolutePath}': No such file or directory`
    )
  }

  const dirName = parts[parts.length - 1]
  const dir = createDirectory(dirName, absolutePath)
  insertNode(tree, absolutePath, dir)

  return success(undefined)
}

// ─── Validation Helpers ──────────────────────────────────────────────────

/**
 * Validate directory creation constraints
 */
const validateDirectoryCreation = (
  name: string,
  absolutePath: string,
  tree: DirectoryNode
): Result<void> => {
  if (!validateFilename(name.split('/').pop() || '')) {
    return error(`mkdir: cannot create directory '${name}': Invalid argument`)
  }

  const existing = findNode(tree, absolutePath)
  if (existing) {
    return error(
      `mkdir: cannot create directory '${absolutePath}': File exists`
    )
  }

  return success(undefined)
}

/**
 * Validate file creation constraints
 */
const validateFileCreation = (
  name: string,
  absolutePath: string,
  tree: DirectoryNode
): Result<void> => {
  if (!validateFilename(name)) {
    return error(`touch: cannot touch '${name}': Invalid argument`)
  }

  const existing = findNode(tree, absolutePath)
  if (existing) {
    return error(`touch: cannot touch '${absolutePath}': File exists`)
  }

  return success(undefined)
}

/**
 * Validate node is a directory
 */
const validateIsDirectory = (
  node: FileSystemNode | undefined,
  path: string,
  command: string = 'cd'
): Result<DirectoryNode> => {
  if (!node) {
    return error(`${command}: ${path}: No such file or directory`)
  }

  if (node.type !== 'directory') {
    return error(`${command}: ${path}: Not a directory`)
  }

  return success(node)
}

/**
 * Validate node is a file
 */
const validateIsFile = (
  node: FileSystemNode | undefined,
  path: string,
  command: string = 'cat'
): Result<FileNode> => {
  if (!node) {
    return error(`${command}: ${path}: No such file or directory`)
  }

  if (node.type !== 'file') {
    return error(`${command}: ${path}: Is a directory`)
  }

  return success(node)
}

// ─── Navigation Operations ───────────────────────────────────────────────

const createNavigationOps = (
  getState: () => FileSystemState,
  setState: (s: FileSystemState) => void,
  eventBus?: EventBus
) => {
  const listDirectory = (path?: string): Result<FileSystemNode[]> => {
    const state = getState()
    const targetPath = path
      ? resolvePath(state.currentPath, path)
      : state.currentPath
    const node = findNode(state.tree, targetPath)

    const validation = validateIsDirectory(node, targetPath, 'ls')
    if (!validation.ok) {
      return validation
    }

    return success(Array.from(validation.value.children.values()))
  }

  return {
  getCurrentPath: (): string => {
    return getState().currentPath
  },

  changeDirectory: (path: string): Result<string> => {
    const state = getState()
    const absolutePath = resolvePath(state.currentPath, path)
    const node = findNode(state.tree, absolutePath)

    const validation = validateIsDirectory(node, absolutePath)
    if (!validation.ok) {
      return validation
    }

    const previousPath = state.currentPath
    setState({ ...state, currentPath: absolutePath })

    if (eventBus && previousPath !== absolutePath) {
      eventBus.emit(
        createDirectoryChangedEvent(previousPath, absolutePath, 'filesystem')
      )
    }

    return success(absolutePath)
  },

  listDirectory,

  listDirectoryDetailed: (path?: string): FileSystemResult<FileSystemNode[]> => {
    return toFileSystemResult(listDirectory(path), 'listDirectory', path)
  }
  }
}

// ─── Directory Operations ────────────────────────────────────────────────

const createDirectoryOps = (
  getState: () => FileSystemState,
  eventBus?: EventBus
) => ({
  createDirectory: (name: string, recursive = false): Result<string> => {
    const state = getState()
    const absolutePath = resolvePath(state.currentPath, name)
    if (isWriteBlockedByReadOnlyMount(state, absolutePath)) {
      return createReadOnlyError('mkdir', absolutePath, 'create directory')
    }

    const validation = validateDirectoryCreation(name, absolutePath, state.tree)
    if (!validation.ok) {
      return validation
    }

    if (recursive) {
      createDirectoriesRecursive(state.tree, absolutePath)
      return success(absolutePath)
    }

    const result = createSingleDirectory(state.tree, absolutePath)
    if (!result.ok) {
      return result
    }

    if (eventBus) {
      const createdDir = findNode(state.tree, absolutePath)
      if (createdDir && createdDir.type === 'directory') {
        eventBus.emit(
          createDirectoryCreatedEvent(createdDir, absolutePath, 'filesystem')
        )
      }
    }

    return success(absolutePath)
  },

  deleteDirectory: (path: string, recursive = false): Result<void> => {
    const state = getState()
    const absolutePath = resolvePath(state.currentPath, path)
    if (isWriteBlockedByReadOnlyMount(state, absolutePath)) {
      return createReadOnlyError('rm', absolutePath, 'remove')
    }

    if (absolutePath === '/') {
      return error(`rm: cannot remove '/': Invalid argument`)
    }

    const node = findNode(state.tree, absolutePath)
    if (!node) {
      return error(
        `rm: cannot remove '${absolutePath}': No such file or directory`
      )
    }

    if (node.type !== 'directory') {
      return error(`rm: cannot remove '${absolutePath}': Not a directory`)
    }

    if (!recursive && node.children.size > 0) {
      return error(`rm: cannot remove '${absolutePath}': Directory not empty`)
    }

    const deletedDir = node.type === 'directory' ? node : undefined
    removeNode(state.tree, absolutePath)

    if (eventBus && deletedDir) {
      eventBus.emit(
        createDirectoryDeletedEvent(absolutePath, deletedDir, 'filesystem')
      )
    }

    return success(undefined)
  }
})

// ─── File Operations ─────────────────────────────────────────────────────

const createFileOps = (
  getState: () => FileSystemState,
  eventBus?: EventBus
) => {
  const readFileAtPath = (path: string): Result<string> => {
    const state = getState()
    const absolutePath = resolvePath(state.currentPath, path)
    const node = findNode(state.tree, absolutePath)

    const validation = validateIsFile(node, absolutePath)
    if (!validation.ok) {
      return validation
    }

    return success(validation.value.content)
  }

  const readFilesAtPaths = (paths: string[]): Result<string[]> => {
    const contents: string[] = []
    for (const path of paths) {
      const fileResult = readFileAtPath(path)
      if (!fileResult.ok) {
        return error(fileResult.error)
      }
      contents.push(fileResult.value)
    }
    return success(contents)
  }

  const writeFileAtPath = (path: string, content: string): Result<void> => {
    const state = getState()
    const absolutePath = resolvePath(state.currentPath, path)
    if (isWriteBlockedByReadOnlyMount(state, absolutePath)) {
      return createReadOnlyError('nano', absolutePath, 'write')
    }
    const node = findNode(state.tree, absolutePath)

    // Si le fichier n'existe pas, le créer
    if (!node) {
      const parentPath = dirname(absolutePath)
      const parent = findNode(state.tree, parentPath)

      if (!parent || parent.type !== 'directory') {
        return error(`nano: cannot create file '${path}': No such file or directory`)
      }

      const fileName = absolutePath.split('/').pop() || path
      if (parent.children.has(fileName)) {
        return error(`nano: cannot create file '${path}': File exists`)
      }

      const newFile = createFile(fileName, absolutePath, content)
      insertNode(state.tree, absolutePath, newFile)

      if (eventBus) {
        eventBus.emit(
          createFileCreatedEvent(newFile, absolutePath, 'filesystem')
        )
      }

      return success(undefined)
    }

    // Si le fichier existe, le modifier
    const validation = validateIsFile(node, absolutePath, 'nano')
    if (!validation.ok) {
      return validation
    }

    const previousFile = validation.value

    // Side effect: Update file with new content and modifiedAt timestamp
    const updatedFile = createFile(previousFile.name, previousFile.path, content)
    removeNode(state.tree, absolutePath)
    insertNode(state.tree, absolutePath, updatedFile)

    if (eventBus) {
      eventBus.emit(
        createFileModifiedEvent(
          absolutePath,
          updatedFile,
          previousFile,
          'filesystem'
        )
      )
    }

    return success(undefined)
  }

  return {
    createFile: (name: string, content = ''): Result<FileNode> => {
      const state = getState()
      const absolutePath = resolvePath(state.currentPath, name)
      if (isWriteBlockedByReadOnlyMount(state, absolutePath)) {
        return createReadOnlyError('touch', absolutePath, 'touch')
      }

      const validation = validateFileCreation(name, absolutePath, state.tree)
      if (!validation.ok) {
        return validation
      }

      try {
        const file = createFile(name, absolutePath, content)
        insertNode(state.tree, absolutePath, file)

        if (eventBus) {
          eventBus.emit(
            createFileCreatedEvent(file, absolutePath, 'filesystem')
          )
        }

        return success(file)
      } catch (err) {
        return error((err as Error).message)
      }
    },

    readFile: (path: string): Result<string> => readFileAtPath(path),

    readFileDetailed: (path: string): FileSystemResult<string> => {
      return toFileSystemResult(readFileAtPath(path), 'readFile', path)
    },

    /**
     * Read several files in order (same resolution rules as readFile).
     * Fails on the first path that cannot be read as a file.
     */
    readFiles: (paths: string[]): Result<string[]> => {
      return readFilesAtPaths(paths)
    },

    readFilesDetailed: (paths: string[]): FileSystemResult<string[]> => {
      const contents: string[] = []
      for (const path of paths) {
        const fileResult = toFileSystemResult(readFileAtPath(path), 'readFile', path)
        if (!fileResult.ok) {
          return {
            ok: false,
            error: {
              ...fileResult.error,
              operation: 'readFiles',
              path
            }
          }
        }
        contents.push(fileResult.value)
      }
      return {
        ok: true,
        value: contents
      }
    },

    writeFile: (path: string, content: string): Result<void> => {
      return writeFileAtPath(path, content)
    },

    writeFileDetailed: (
      path: string,
      content: string
    ): FileSystemResult<void> => {
      return toFileSystemResult(writeFileAtPath(path, content), 'writeFile', path)
    },

    deleteFile: (path: string): Result<void> => {
      const state = getState()
      const absolutePath = resolvePath(state.currentPath, path)
      if (isWriteBlockedByReadOnlyMount(state, absolutePath)) {
        return createReadOnlyError('rm', absolutePath, 'remove')
      }
      const node = findNode(state.tree, absolutePath)

      const validation = validateIsFile(node, absolutePath, 'rm')
      if (!validation.ok) {
        return validation
      }

      const deletedFile = validation.value
      removeNode(state.tree, absolutePath)

      if (eventBus) {
        eventBus.emit(
          createFileDeletedEvent(absolutePath, deletedFile, 'filesystem')
        )
      }

      return success(undefined)
    }
  }
}

// ─── State Management ────────────────────────────────────────────────────

const createStateOps = (
  getState: () => FileSystemState,
  setState: (s: FileSystemState) => void,
  mutableState?: FileSystemState
) => ({
  toJSON: (): FileSystemState => {
    // En mode mutable, retourner directement le state original (pas de clone)
    if (mutableState) {
      return mutableState
    }

    // En mode normal, cloner pour éviter les mutations externes
    const state = getState()
    const cloneNode = (node: FileSystemNode): FileSystemNode => {
      if (node.type === 'file') {
        return createFile(node.name, node.path, node.content)
      }

      const dir = createDirectory(node.name, node.path)
      for (const [key, child] of node.children) {
        dir.children.set(key, cloneNode(child))
      }
      return dir
    }

    return {
      currentPath: state.currentPath,
      tree: cloneNode(state.tree) as DirectoryNode,
      readOnlyMountPaths:
        state.readOnlyMountPaths == null
          ? undefined
          : new Set(state.readOnlyMountPaths)
    }
  },

  loadState: (newState: FileSystemState): void => {
    if (mutableState) {
      // Mode mutable : modifier directement
      mutableState.currentPath = newState.currentPath
      mutableState.tree = newState.tree
      mutableState.readOnlyMountPaths = newState.readOnlyMountPaths
    } else {
      // Mode normal : remplacer
      setState(newState)
    }
  }
})

/**
 * Create FileSystem instance with closure-based state management
 * @param initialState - Initial filesystem state (optional)
 * @param eventBus - EventBus for emitting filesystem events (optional)
 * @param options - Configuration options
 * @param options.mutable - If true and initialState is provided, modifies the original state directly instead of creating a copy
 */
export const createFileSystem = (
  initialState?: FileSystemState,
  eventBus?: EventBus,
  options?: { mutable?: boolean }
) => {
  const isMutable = options?.mutable ?? false
  const originalState = initialState
  let state: FileSystemState = initialState || {
    currentPath: '/',
    tree: createDirectory('root', '/')
  }

  const getState = () => state
  const setState = (newState: FileSystemState) => {
    if (isMutable && originalState) {
      // Mode mutable : modifier directement le state original
      originalState.currentPath = newState.currentPath
      originalState.tree = newState.tree
      originalState.readOnlyMountPaths = newState.readOnlyMountPaths
      // Mettre à jour la référence locale aussi
      state = originalState
    } else {
      // Mode normal : remplacer la référence
      state = newState
    }
  }

  return {
    ...createNavigationOps(getState, setState, eventBus),
    ...createDirectoryOps(getState, eventBus),
    ...createFileOps(getState, eventBus),
    ...createStateOps(
      getState,
      setState,
      isMutable && originalState ? originalState : undefined
    )
  }
}

/**
 * FileSystem type (inferred from factory return)
 */
export type FileSystem = ReturnType<typeof createFileSystem>
