import type { FileSystemState } from '../../filesystem/FileSystem'
import { createDirectory, type DirectoryNode } from '../../filesystem/models'
import type { VolumeMountBinding } from './types'

const splitPath = (absolutePath: string): string[] => {
  return absolutePath.split('/').filter((segment) => segment.length > 0)
}

const ensureDirectoryForPath = (
  root: DirectoryNode,
  absolutePath: string
): DirectoryNode => {
  const parts = splitPath(absolutePath)
  let current = root
  let currentPath = ''
  for (const part of parts) {
    currentPath += `/${part}`
    const child = current.children.get(part)
    if (child == null || child.type !== 'directory') {
      const directory = createDirectory(part, currentPath)
      current.children.set(part, directory)
      current = directory
      continue
    }
    current = child
  }
  return current
}

const mountBackingDirectory = (
  root: DirectoryNode,
  mountPath: string,
  backingRoot: DirectoryNode
): void => {
  if (mountPath === '/') {
    for (const [name, node] of backingRoot.children.entries()) {
      root.children.set(name, node)
    }
    return
  }
  const parts = splitPath(mountPath)
  if (parts.length === 0) {
    return
  }
  const directoryName = parts[parts.length - 1]
  const parentPath = `/${parts.slice(0, -1).join('/')}`
  const parentDirectory = ensureDirectoryForPath(root, parentPath)
  parentDirectory.children.set(directoryName, backingRoot)
}

export const applyVolumeMountBindingsToFileSystem = (
  rootFileSystem: FileSystemState,
  bindings: readonly VolumeMountBinding[]
): FileSystemState => {
  for (const binding of bindings) {
    mountBackingDirectory(
      rootFileSystem.tree,
      binding.mountPath,
      binding.backing.tree
    )
  }
  return rootFileSystem
}
