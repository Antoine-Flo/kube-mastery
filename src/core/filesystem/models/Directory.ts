import type { FileNode } from './File'

// Directory node interface
export interface DirectoryNode {
  readonly type: 'directory'
  readonly name: string
  readonly path: string
  readonly children: Map<string, FileSystemNode>
}

// Union type for filesystem nodes
export type FileSystemNode = DirectoryNode | FileNode

// Factory function: Create immutable directory
export const createDirectory = (name: string, path: string): DirectoryNode => {
  return Object.freeze({
    type: 'directory',
    name,
    path,
    children: new Map<string, FileSystemNode>()
  })
}
