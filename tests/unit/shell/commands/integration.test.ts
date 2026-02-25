import { beforeEach, describe, expect, it } from 'vitest'
import { error, success } from '../../../../src/core/shared/result'
import type {
  EditorModal,
  FileSystem
} from '../../../../src/core/shell/commands/index'
import { createShellExecutor } from '../../../../src/core/shell/commands/index'
import {
  createFile as createFileNode,
  createDirectory
} from '../../../../src/core/filesystem/models'
import type { FileSystemState } from '../../../../src/core/filesystem/FileSystem'
import { createMockFileSystem } from '../../helpers/mockFileSystem'

describe('Shell Commands Integration', () => {
  let fileSystem: FileSystem
  let editorModal: EditorModal

  beforeEach(() => {
    fileSystem = createMockFileSystem({
      changeDirectory: (path: string) => {
        if (path === '/invalid') {
          return error('Directory not found')
        }
        return success('')
      },
      listDirectory: (path?: string) => {
        if (path === '/invalid') {
          return error('Directory not found')
        }
        return success([
          createFileNode('file1', '/home/kube/file1'),
          createDirectory('dir1', '/home/kube/dir1')
        ])
      },
      createFile: (fileName: string) => {
        if (fileName === 'error.txt') {
          return error('Permission denied')
        }
        return success(createFileNode(fileName, `/home/kube/${fileName}`))
      },
      readFile: (filePath: string) => {
        if (filePath === 'missing.txt') {
          return error('File not found')
        }
        return success('file content')
      }
    })

    editorModal = {
      open: () => {}
    }
  })

  it('should execute pwd command', () => {
    const executor = createShellExecutor(fileSystem)
    const result = executor.execute('pwd')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('/home/kube')
    }
  })

  it('should execute cd command', () => {
    const executor = createShellExecutor(fileSystem)
    const result = executor.execute('cd /home')

    expect(result.ok).toBe(true)
  })

  it('should execute ls command', () => {
    const executor = createShellExecutor(fileSystem)
    const result = executor.execute('ls')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('file1')
      expect(result.value).toContain('dir1')
    }
  })

  it('should execute ls -l command', () => {
    const executor = createShellExecutor(fileSystem)
    const result = executor.execute('ls -l')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('file1')
    }
  })

  it('should execute touch command', () => {
    const executor = createShellExecutor(fileSystem)
    const result = executor.execute('touch newfile.txt')

    expect(result.ok).toBe(true)
  })

  it('should execute cat command', () => {
    const executor = createShellExecutor(fileSystem)
    const result = executor.execute('cat test.txt')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('file content')
    }
  })

  it('should execute rm command', () => {
    const executor = createShellExecutor(fileSystem)
    const result = executor.execute('rm file.txt')

    expect(result.ok).toBe(true)
  })

  it('should execute rm -r command', () => {
    const executor = createShellExecutor(fileSystem)
    const result = executor.execute('rm -r dir')

    expect(result.ok).toBe(true)
  })

  it('should execute mkdir command', () => {
    const executor = createShellExecutor(fileSystem)
    const result = executor.execute('mkdir newdir')

    expect(result.ok).toBe(true)
  })

  it('should execute nano command', () => {
    const executor = createShellExecutor(fileSystem, editorModal)
    const result = executor.execute('nano test.yaml')

    expect(result.ok).toBe(true)
  })

  it('should handle vi alias', () => {
    const executor = createShellExecutor(fileSystem, editorModal)
    const result = executor.execute('vi test.yaml')

    expect(result.ok).toBe(true)
  })

  it('should handle vim alias', () => {
    const executor = createShellExecutor(fileSystem, editorModal)
    const result = executor.execute('vim test.yaml')

    expect(result.ok).toBe(true)
  })

  it('should execute clear command', () => {
    const executor = createShellExecutor(fileSystem)
    const result = executor.execute('clear')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('')
    }
  })

  it('should execute help command', () => {
    const executor = createShellExecutor(fileSystem)
    const result = executor.execute('help')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('Available shell commands')
    }
  })

  it('should execute debug command', () => {
    const executor = createShellExecutor(fileSystem)
    const result = executor.execute('debug')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('Debug commands')
    }
  })

  it('should execute nslookup with runtime options', () => {
    const executor = createShellExecutor(fileSystem, undefined, {
      resolveNamespace: () => 'dev',
      runDnsLookup: (query, namespace) =>
        success(`query=${query} namespace=${namespace}`)
    })
    const result = executor.execute('nslookup web.dev.svc.cluster.local')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe('query=web.dev.svc.cluster.local namespace=dev')
    }
  })

  it('should execute curl with runtime options', () => {
    const executor = createShellExecutor(fileSystem, undefined, {
      resolveNamespace: () => 'dev',
      runCurl: (target, namespace) =>
        success(`target=${target} namespace=${namespace}`)
    })
    const result = executor.execute('curl http://web.dev.svc.cluster.local')

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toBe(
        'target=http://web.dev.svc.cluster.local namespace=dev'
      )
    }
  })

  it('should handle errors gracefully', () => {
    const executor = createShellExecutor(fileSystem)
    const result = executor.execute('cat missing.txt')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('File not found')
    }
  })

  it('should reject unknown commands', () => {
    const executor = createShellExecutor(fileSystem)
    const result = executor.execute('unknown-command')

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Unknown command')
    }
  })

  // ─── Scénarios Réalistes ──────────────────────────────────────────────────

  describe('Realistic shell scenarios', () => {
    it('should handle sequence: mkdir test && cd test && touch file.txt && cat file.txt && ls -l', () => {
      let currentPath = '/home/kube'
      const files: Record<string, string> = {}
      const dirs = new Set<string>(['/home/kube'])

      const realisticFileSystem: FileSystem = {
        getCurrentPath: () => currentPath,
        changeDirectory: (path: string) => {
          if (path === 'test' && dirs.has('/home/kube/test')) {
            currentPath = '/home/kube/test'
            return success('')
          }
          if (path === '/home/kube' && dirs.has('/home/kube')) {
            currentPath = '/home/kube'
            return success('')
          }
          return error('Directory not found')
        },
        listDirectory: (path?: string) => {
          const targetPath = path || currentPath
          if (targetPath === '/home/kube/test') {
            return success([
              createFileNode(
                'file.txt',
                `${targetPath}/file.txt`,
                'test content'
              )
            ])
          }
          return success([createDirectory('test', '/home/kube/test')])
        },
        createFile: (fileName: string) => {
          const fullPath = `${currentPath}/${fileName}`
          files[fullPath] = ''
          return success(createFileNode(fileName, fullPath))
        },
        readFile: (filePath: string) => {
          const fullPath = filePath.startsWith('/')
            ? filePath
            : `${currentPath}/${filePath}`
          if (files[fullPath] !== undefined) {
            return success('test content')
          }
          return error('File not found')
        },
        writeFile: () => success(undefined),
        deleteFile: () => success(undefined),
        deleteDirectory: () => success(undefined),
        createDirectory: (dirName: string) => {
          const fullPath = dirName.startsWith('/')
            ? dirName
            : `${currentPath}/${dirName}`
          dirs.add(fullPath)
          return success('')
        },
        toJSON: (): FileSystemState => ({
          currentPath,
          tree: createDirectory('root', '/')
        }),
        loadState: () => {}
      }

      const executor = createShellExecutor(realisticFileSystem)

      // mkdir test
      const mkdirResult = executor.execute('mkdir test')
      expect(mkdirResult.ok).toBe(true)

      // cd test
      const cdResult = executor.execute('cd test')
      expect(cdResult.ok).toBe(true)

      // touch file.txt
      const touchResult = executor.execute('touch file.txt')
      expect(touchResult.ok).toBe(true)

      // cat file.txt
      const catResult = executor.execute('cat file.txt')
      expect(catResult.ok).toBe(true)
      if (catResult.ok) {
        expect(catResult.value).toBe('test content')
      }

      // ls -l
      const lsResult = executor.execute('ls -l')
      expect(lsResult.ok).toBe(true)
      if (lsResult.ok) {
        expect(lsResult.value).toContain('file.txt')
      }
    })

    it('should handle sequence: cd .. && ls', () => {
      let currentPath = '/home/kube/subdir'
      const realisticFileSystem: FileSystem = {
        getCurrentPath: () => currentPath,
        changeDirectory: (path: string) => {
          if (path === '..') {
            currentPath = '/home/kube'
            return success('')
          }
          return error('Directory not found')
        },
        listDirectory: (path?: string) => {
          const targetPath = path || currentPath
          if (targetPath === '/home/kube') {
            return success([
              createFileNode('file1', '/home/kube/file1'),
              createDirectory('subdir', '/home/kube/subdir')
            ])
          }
          return success([])
        },
        createFile: () => success(createFileNode('test', '/home/kube/test')),
        readFile: () => success(''),
        writeFile: () => success(undefined),
        deleteFile: () => success(undefined),
        deleteDirectory: () => success(undefined),
        createDirectory: () => success(''),
        toJSON: (): FileSystemState => ({
          currentPath,
          tree: createDirectory('root', '/')
        }),
        loadState: () => {}
      }

      const executor = createShellExecutor(realisticFileSystem)

      // cd ..
      const cdResult = executor.execute('cd ..')
      expect(cdResult.ok).toBe(true)

      // ls
      const lsResult = executor.execute('ls')
      expect(lsResult.ok).toBe(true)
      if (lsResult.ok) {
        expect(lsResult.value).toContain('file1')
        expect(lsResult.value).toContain('subdir')
      }
    })

    it('should handle sequence: touch a b c && ls a b c', () => {
      const files = new Set<string>()
      const realisticFileSystem: FileSystem = {
        getCurrentPath: () => '/home/kube',
        changeDirectory: () => success(''),
        listDirectory: (path?: string) => {
          if (path && files.has(path)) {
            return success([createFileNode(path, `/home/kube/${path}`)])
          }
          const fileList = Array.from(files).map((name) =>
            createFileNode(name, `/home/kube/${name}`)
          )
          return success(fileList)
        },
        createFile: (fileName: string) => {
          files.add(fileName)
          return success(createFileNode(fileName, `/home/kube/${fileName}`))
        },
        readFile: () => success(''),
        writeFile: () => success(undefined),
        deleteFile: () => success(undefined),
        deleteDirectory: () => success(undefined),
        createDirectory: () => success(''),
        toJSON: (): FileSystemState => ({
          currentPath: '/home/kube',
          tree: createDirectory('root', '/')
        }),
        loadState: () => {}
      }

      const executor = createShellExecutor(realisticFileSystem)

      // touch a b c (realistic shell behavior: should create all files)
      const touchResult = executor.execute('touch a b c')
      expect(touchResult.ok).toBe(true)

      // ls a b c (realistic shell behavior: should list all files)
      const lsResult = executor.execute('ls a b c')
      expect(lsResult.ok).toBe(true)
      if (lsResult.ok) {
        expect(lsResult.value).toContain('a')
        expect(lsResult.value).toContain('b')
        expect(lsResult.value).toContain('c')
      }
    })

    it('should handle sequence: rm file1 file2 and verify deletion', () => {
      const files = new Set<string>(['file1', 'file2', 'file3'])
      const realisticFileSystem: FileSystem = {
        getCurrentPath: () => '/home/kube',
        changeDirectory: () => success(''),
        listDirectory: () => {
          const fileList = Array.from(files).map((name) =>
            createFileNode(name, `/home/kube/${name}`)
          )
          return success(fileList)
        },
        createFile: () => success(createFileNode('test', '/home/kube/test')),
        readFile: () => success(''),
        writeFile: () => success(undefined),
        deleteFile: (target: string) => {
          if (files.has(target)) {
            files.delete(target)
            return success(undefined)
          }
          return error('File not found')
        },
        deleteDirectory: () => success(undefined),
        createDirectory: () => success(''),
        toJSON: (): FileSystemState => ({
          currentPath: '/home/kube',
          tree: createDirectory('root', '/')
        }),
        loadState: () => {}
      }

      const executor = createShellExecutor(realisticFileSystem)

      // rm file1 file2 (realistic shell behavior: should delete all files)
      const rmResult = executor.execute('rm file1 file2')
      expect(rmResult.ok).toBe(true)

      // Verify with ls (file3 should still be there, file1 and file2 should be gone)
      const lsResult = executor.execute('ls')
      expect(lsResult.ok).toBe(true)
      if (lsResult.ok) {
        expect(lsResult.value).toContain('file3')
        expect(lsResult.value).not.toContain('file1')
        expect(lsResult.value).not.toContain('file2')
      }
    })

    it('should handle error cascade: valid command after invalid command', () => {
      const executor = createShellExecutor(fileSystem)

      // Invalid command
      const invalidResult = executor.execute('invalid-command')
      expect(invalidResult.ok).toBe(false)

      // Valid command should still work
      const validResult = executor.execute('pwd')
      expect(validResult.ok).toBe(true)
      if (validResult.ok) {
        expect(validResult.value).toBe('/home/kube')
      }
    })

    it('should handle relative paths in realistic workflow', () => {
      let currentPath = '/home/kube'
      const realisticFileSystem: FileSystem = {
        getCurrentPath: () => currentPath,
        changeDirectory: (path: string) => {
          if (path === 'subdir') {
            currentPath = '/home/kube/subdir'
            return success('')
          }
          if (path === '..') {
            currentPath = '/home/kube'
            return success('')
          }
          return error('Directory not found')
        },
        listDirectory: (path?: string) => {
          const targetPath = path || currentPath
          if (targetPath === '/home/kube/subdir') {
            return success([
              createFileNode('file.txt', '/home/kube/subdir/file.txt')
            ])
          }
          return success([createDirectory('subdir', '/home/kube/subdir')])
        },
        createFile: () => success(createFileNode('test', '/home/kube/test')),
        readFile: () => success(''),
        writeFile: () => success(undefined),
        deleteFile: () => success(undefined),
        deleteDirectory: () => success(undefined),
        createDirectory: () => success(''),
        toJSON: (): FileSystemState => ({
          currentPath,
          tree: createDirectory('root', '/')
        }),
        loadState: () => {}
      }

      const executor = createShellExecutor(realisticFileSystem)

      // cd subdir
      const cdResult = executor.execute('cd subdir')
      expect(cdResult.ok).toBe(true)

      // ls .
      const lsDotResult = executor.execute('ls .')
      expect(lsDotResult.ok).toBe(true)

      // cd ..
      const cdParentResult = executor.execute('cd ..')
      expect(cdParentResult.ok).toBe(true)

      // ls
      const lsResult = executor.execute('ls')
      expect(lsResult.ok).toBe(true)
    })
  })
})
