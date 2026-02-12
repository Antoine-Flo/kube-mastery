import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import type { FileSystem } from '../../src/core/filesystem/FileSystem'
import { createFileSystem } from '../../src/core/filesystem/FileSystem'
import { createDirectory } from '../../src/core/filesystem/models/Directory'
import { createFile } from '../../src/core/filesystem/models/File'

export const createSeedFileSystem = (seedDir: string): FileSystem => {
  const root = createDirectory('root', '/')
  const entries = readdirSync(seedDir, { withFileTypes: true })
  const files = entries.filter(
    (e) => e.isFile() && (e.name.endsWith('.yaml') || e.name.endsWith('.yml'))
  )
  for (const f of files) {
    const content = readFileSync(join(seedDir, f.name), 'utf-8')
    const fileNode = createFile(f.name, `/${f.name}`, content)
    root.children.set(f.name, fileNode)
  }
  return createFileSystem({ currentPath: '/', tree: root })
}
