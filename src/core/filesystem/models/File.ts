// File node interface
export interface FileNode {
  readonly type: 'file'
  readonly name: string
  readonly path: string
  readonly content: string
  readonly extension: string
  readonly createdAt: string
  readonly modifiedAt: string
}

// Pure function: Extract file extension from filename (internal use only)
const getFileExtension = (filename: string): string => {
  // Handle paths - get just the filename
  const parts = filename.split('/')
  const name = parts[parts.length - 1]

  const lastDot = name.lastIndexOf('.')
  if (lastDot === -1 || lastDot === 0) {
    return ''
  }

  return name.substring(lastDot)
}

// Factory function: Create immutable file
export const createFile = (
  name: string,
  path: string,
  content: string = ''
): FileNode => {
  const extension = getFileExtension(name)
  const now = new Date().toISOString()

  return Object.freeze({
    type: 'file',
    name,
    path,
    content,
    extension,
    createdAt: now,
    modifiedAt: now
  })
}
