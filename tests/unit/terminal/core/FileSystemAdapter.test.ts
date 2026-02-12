import { beforeEach, describe, expect, it } from 'vitest'
import { createFileSystem } from '../../../../src/core/filesystem/FileSystem'
import type { FileSystemState } from '../../../../src/core/filesystem/FileSystem'

describe('FileSystemAdapter', () => {
  let fileSystemState: FileSystemState
  let fileSystem: ReturnType<typeof createFileSystem>

  beforeEach(() => {
    // Créer la structure de base /home/kube dans l'arbre
    const homeDir = {
      type: 'directory' as const,
      name: 'home',
      path: '/home',
      children: new Map(),
      createdAt: '',
      modifiedAt: ''
    }
    const kubeDir = {
      type: 'directory' as const,
      name: 'kube',
      path: '/home/kube',
      children: new Map(),
      createdAt: '',
      modifiedAt: ''
    }
    homeDir.children.set('kube', kubeDir)

    const root = {
      type: 'directory' as const,
      name: 'root',
      path: '/',
      children: new Map([['home', homeDir]]),
      createdAt: '',
      modifiedAt: ''
    }

    fileSystemState = {
      currentPath: '/home/kube',
      tree: root
    }
    fileSystem = createFileSystem(fileSystemState, undefined, { mutable: true })
  })

  describe('getCurrentPath', () => {
    it('should return current path', () => {
      expect(fileSystem.getCurrentPath()).toBe('/home/kube')
    })

    it('should return current path even if empty', () => {
      fileSystemState.currentPath = ''
      expect(fileSystem.getCurrentPath()).toBe('')
    })
  })

  describe('changeDirectory', () => {
    it('should change to existing directory', () => {
      // Créer un répertoire
      const result = fileSystem.createDirectory('test')
      expect(result.ok).toBe(true)

      // Changer vers ce répertoire
      const cdResult = fileSystem.changeDirectory('test')
      expect(cdResult.ok).toBe(true)
      expect(fileSystem.getCurrentPath()).toBe('/home/kube/test')
    })

    it('should change to absolute path', () => {
      fileSystem.createDirectory('test')
      const result = fileSystem.changeDirectory('/home/kube/test')
      expect(result.ok).toBe(true)
      expect(fileSystem.getCurrentPath()).toBe('/home/kube/test')
    })

    it('should handle parent directory (..)', () => {
      fileSystem.createDirectory('test')
      fileSystem.changeDirectory('test')
      const result = fileSystem.changeDirectory('..')
      expect(result.ok).toBe(true)
      expect(fileSystem.getCurrentPath()).toBe('/home/kube')
    })

    it('should handle current directory (.)', () => {
      const initialPath = fileSystem.getCurrentPath()
      const result = fileSystem.changeDirectory('.')
      expect(result.ok).toBe(true)
      expect(fileSystem.getCurrentPath()).toBe(initialPath)
    })

    it('should return error for non-existent directory', () => {
      const result = fileSystem.changeDirectory('/invalid/path')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('No such file or directory')
      }
    })

    it('should return error when trying to cd into a file', () => {
      fileSystem.createFile('test.txt')
      const result = fileSystem.changeDirectory('test.txt')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('Not a directory')
      }
    })
  })

  describe('listDirectory', () => {
    it('should list empty directory', () => {
      const result = fileSystem.listDirectory()
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toEqual([])
      }
    })

    it('should list directory contents', () => {
      fileSystem.createFile('file1.txt')
      fileSystem.createDirectory('dir1')

      const result = fileSystem.listDirectory()
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.length).toBe(2)
        expect(result.value.some((f) => f.name === 'file1.txt')).toBe(true)
        expect(result.value.some((f) => f.name === 'dir1')).toBe(true)
      }
    })

    it('should list specific directory', () => {
      const createDirResult = fileSystem.createDirectory('test')
      expect(createDirResult.ok).toBe(true)

      // Changer vers le répertoire test pour créer le fichier dedans
      const cdResult = fileSystem.changeDirectory('test')
      expect(cdResult.ok).toBe(true)

      const createFileResult = fileSystem.createFile('file.txt')
      expect(createFileResult.ok).toBe(true)

      // Revenir au répertoire parent
      fileSystem.changeDirectory('..')

      const result = fileSystem.listDirectory('test')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.length).toBe(1)
        expect(result.value[0].name).toBe('file.txt')
      }
    })

    it('should return error for non-existent directory', () => {
      const result = fileSystem.listDirectory('/invalid')
      expect(result.ok).toBe(false)
    })
  })

  describe('createFile', () => {
    it('should create a file', () => {
      const result = fileSystem.createFile('test.txt')
      expect(result.ok).toBe(true)

      const listResult = fileSystem.listDirectory()
      if (listResult.ok) {
        expect(
          listResult.value.some(
            (f) => f.name === 'test.txt' && f.type === 'file'
          )
        ).toBe(true)
      }
    })

    it('should return error if file already exists', () => {
      fileSystem.createFile('test.txt')
      const result = fileSystem.createFile('test.txt')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('File exists')
      }
    })
  })

  describe('readFile', () => {
    it('should read file content', () => {
      fileSystem.createFile('test.txt')
      fileSystem.writeFile('test.txt', 'hello world')

      const result = fileSystem.readFile('test.txt')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe('hello world')
      }
    })

    it('should return empty string for empty file', () => {
      fileSystem.createFile('empty.txt')
      const result = fileSystem.readFile('empty.txt')
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe('')
      }
    })

    it('should return error for non-existent file', () => {
      const result = fileSystem.readFile('missing.txt')
      expect(result.ok).toBe(false)
    })

    it('should return error when trying to read a directory', () => {
      fileSystem.createDirectory('test')
      const result = fileSystem.readFile('test')
      expect(result.ok).toBe(false)
    })
  })

  describe('writeFile', () => {
    it('should write to existing file', () => {
      fileSystem.createFile('test.txt')
      const result = fileSystem.writeFile('test.txt', 'content')
      expect(result.ok).toBe(true)

      const readResult = fileSystem.readFile('test.txt')
      if (readResult.ok) {
        expect(readResult.value).toBe('content')
      }
    })

    it('should create file if it does not exist', () => {
      const result = fileSystem.writeFile('new.txt', 'content')
      expect(result.ok).toBe(true)

      const readResult = fileSystem.readFile('new.txt')
      if (readResult.ok) {
        expect(readResult.value).toBe('content')
      }
    })

    it('should overwrite existing file content', () => {
      fileSystem.createFile('test.txt')
      fileSystem.writeFile('test.txt', 'old')
      fileSystem.writeFile('test.txt', 'new')

      const readResult = fileSystem.readFile('test.txt')
      if (readResult.ok) {
        expect(readResult.value).toBe('new')
      }
    })
  })

  describe('deleteFile', () => {
    it('should delete a file', () => {
      fileSystem.createFile('test.txt')
      const result = fileSystem.deleteFile('test.txt')
      expect(result.ok).toBe(true)

      const listResult = fileSystem.listDirectory()
      if (listResult.ok) {
        expect(listResult.value.some((f) => f.name === 'test.txt')).toBe(false)
      }
    })

    it('should return error for non-existent file', () => {
      const result = fileSystem.deleteFile('missing.txt')
      expect(result.ok).toBe(false)
    })

    it('should return error when trying to delete a directory', () => {
      fileSystem.createDirectory('test')
      const result = fileSystem.deleteFile('test')
      expect(result.ok).toBe(false)
    })
  })

  describe('createDirectory', () => {
    it('should create a directory', () => {
      const result = fileSystem.createDirectory('test')
      expect(result.ok).toBe(true)

      const listResult = fileSystem.listDirectory()
      if (listResult.ok) {
        expect(
          listResult.value.some(
            (f) => f.name === 'test' && f.type === 'directory'
          )
        ).toBe(true)
      }
    })

    it('should return error if directory already exists', () => {
      fileSystem.createDirectory('test')
      const result = fileSystem.createDirectory('test')
      expect(result.ok).toBe(false)
    })
  })

  describe('deleteDirectory', () => {
    it('should delete an empty directory', () => {
      fileSystem.createDirectory('test')
      const result = fileSystem.deleteDirectory('test')
      expect(result.ok).toBe(true)

      const listResult = fileSystem.listDirectory()
      if (listResult.ok) {
        expect(listResult.value.some((f) => f.name === 'test')).toBe(false)
      }
    })

    it('should return error for non-empty directory', () => {
      const createDirResult = fileSystem.createDirectory('test')
      expect(createDirResult.ok).toBe(true)

      // Changer vers le répertoire test pour créer le fichier dedans
      const cdResult = fileSystem.changeDirectory('test')
      expect(cdResult.ok).toBe(true)

      const createFileResult = fileSystem.createFile('file.txt')
      expect(createFileResult.ok).toBe(true)

      // Revenir au répertoire parent
      fileSystem.changeDirectory('..')

      const result = fileSystem.deleteDirectory('test')
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('not empty')
      }
    })

    it('should return error for non-existent directory', () => {
      const result = fileSystem.deleteDirectory('missing')
      expect(result.ok).toBe(false)
    })

    it('should return error when trying to delete a file', () => {
      fileSystem.createFile('test.txt')
      const result = fileSystem.deleteDirectory('test.txt')
      expect(result.ok).toBe(false)
    })
  })
})
