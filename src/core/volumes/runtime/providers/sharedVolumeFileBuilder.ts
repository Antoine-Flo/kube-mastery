import type { FileSystemState } from '../../../filesystem/FileSystem'
import { createDirectory, createFile, type DirectoryNode } from '../../../filesystem/models'

const splitPath = (path: string): string[] => {
  return path.split('/').filter((segment) => segment.length > 0)
}

const ensureDirectory = (
  root: DirectoryNode,
  path: string
): DirectoryNode => {
  const parts = splitPath(path)
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

const createEmptyBacking = (): FileSystemState => {
  return {
    currentPath: '/',
    tree: createDirectory('root', '/')
  }
}

const toFileEntries = (
  data: Record<string, string>,
  items:
    | Array<{
        key: string
        path: string
      }>
    | undefined
): Array<{ path: string; content: string }> => {
  if (items == null || items.length === 0) {
    return Object.entries(data).map(([key, value]) => {
      return {
        path: key,
        content: value
      }
    })
  }
  const entries: Array<{ path: string; content: string }> = []
  for (const item of items) {
    const value = data[item.key]
    if (value == null) {
      continue
    }
    entries.push({
      path: item.path,
      content: value
    })
  }
  return entries
}

export const createBackingFromKeyValueData = (
  data: Record<string, string>,
  items:
    | Array<{
        key: string
        path: string
      }>
    | undefined
): FileSystemState => {
  const backing = createEmptyBacking()
  for (const entry of toFileEntries(data, items)) {
    const normalizedPath = entry.path.startsWith('/')
      ? entry.path
      : `/${entry.path}`
    const parts = splitPath(normalizedPath)
    if (parts.length === 0) {
      continue
    }
    const fileName = parts[parts.length - 1]
    const parentPath = `/${parts.slice(0, -1).join('/')}`
    const parentDirectory = ensureDirectory(backing.tree, parentPath)
    parentDirectory.children.set(
      fileName,
      createFile(fileName, normalizedPath, entry.content)
    )
  }
  return backing
}

export const createEmptyVolumeBacking = (): FileSystemState => {
  return createEmptyBacking()
}
