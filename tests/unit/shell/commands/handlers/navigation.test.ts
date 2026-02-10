import { describe, expect, it } from 'vitest'
import { error, success } from '../../../../../src/core/shared/result'
import { createCdHandler } from '../../../../../src/core/shell/commands/handlers/navigation/cd'
import { createLsHandler } from '../../../../../src/core/shell/commands/handlers/navigation/ls'
import { createPwdHandler } from '../../../../../src/core/shell/commands/handlers/navigation/pwd'
import { createMockFileSystem } from '../../../helpers/mockFileSystem'
import { createFile as createFileNode, createDirectory } from '../../../../../src/core/filesystem/models'

describe('Navigation Handlers', () => {
  describe('pwd', () => {
    it('should return current path', () => {
      const fileSystem = createMockFileSystem({
        getCurrentPath: () => '/home/kube'
      })
      const handler = createPwdHandler(fileSystem)
      const result = handler.execute([], {})

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe('/home/kube')
      }
    })
  })

  describe('cd', () => {
    it('should change to specified directory', () => {
      const fileSystem = createMockFileSystem({
        changeDirectory: (path: string) => {
          expect(path).toBe('/home')
          return success('')
        }
      })
      const handler = createCdHandler(fileSystem)
      const result = handler.execute(['/home'], {})

      expect(result.ok).toBe(true)
    })

    it('should return error on filesystem error', () => {
      const fileSystem = createMockFileSystem({
        changeDirectory: () => error('Directory not found')
      })
      const handler = createCdHandler(fileSystem)
      const result = handler.execute(['/invalid'], {})

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe('Directory not found')
      }
    })

    it('should change to parent directory with ..', () => {
      const fileSystem = createMockFileSystem({
        changeDirectory: (path: string) => {
          expect(path).toBe('..')
          return success('')
        }
      })
      const handler = createCdHandler(fileSystem)
      const result = handler.execute(['..'], {})

      expect(result.ok).toBe(true)
    })

    it('should change to current directory with .', () => {
      const fileSystem = createMockFileSystem({
        changeDirectory: (path: string) => {
          expect(path).toBe('.')
          return success('')
        }
      })
      const handler = createCdHandler(fileSystem)
      const result = handler.execute(['.'], {})

      expect(result.ok).toBe(true)
    })

    it('should handle relative path ../dir', () => {
      const fileSystem = createMockFileSystem({
        changeDirectory: (path: string) => {
          expect(path).toBe('../dir')
          return success('')
        }
      })
      const handler = createCdHandler(fileSystem)
      const result = handler.execute(['../dir'], {})

      expect(result.ok).toBe(true)
    })

    it('should handle relative path ./subdir', () => {
      const fileSystem = createMockFileSystem({
        changeDirectory: (path: string) => {
          expect(path).toBe('./subdir')
          return success('')
        }
      })
      const handler = createCdHandler(fileSystem)
      const result = handler.execute(['./subdir'], {})

      expect(result.ok).toBe(true)
    })

    it('should handle paths with dashes', () => {
      const fileSystem = createMockFileSystem({
        changeDirectory: (path: string) => {
          expect(path).toBe('my-dir')
          return success('')
        }
      })
      const handler = createCdHandler(fileSystem)
      const result = handler.execute(['my-dir'], {})

      expect(result.ok).toBe(true)
    })

    it('should handle paths with underscores', () => {
      const fileSystem = createMockFileSystem({
        changeDirectory: (path: string) => {
          expect(path).toBe('my_dir')
          return success('')
        }
      })
      const handler = createCdHandler(fileSystem)
      const result = handler.execute(['my_dir'], {})

      expect(result.ok).toBe(true)
    })

    it('should return error when trying to cd into a file', () => {
      const fileSystem = createMockFileSystem({
        changeDirectory: () => error('Not a directory')
      })
      const handler = createCdHandler(fileSystem)
      const result = handler.execute(['file.txt'], {})

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe('Not a directory')
      }
    })

    it('should change to home when no args (realistic shell behavior)', () => {
      // Realistic shell behavior: cd without args goes to home (~)
      const fileSystem = createMockFileSystem({
        changeDirectory: (path: string) => {
          expect(path).toBe('~')
          return success('')
        }
      })
      const handler = createCdHandler(fileSystem)
      const result = handler.execute([], {})

      expect(result.ok).toBe(true)
    })
  })

  describe('ls', () => {
    it('should list directory contents', () => {
      const fileSystem = createMockFileSystem({
        listDirectory: () =>
          success([createFileNode('file1', '/home/kube/file1'), createDirectory('dir1', '/home/kube/dir1')])
      })
      const handler = createLsHandler(fileSystem)
      const result = handler.execute([], {})

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('file1')
        expect(result.value).toContain('dir1')
      }
    })

    it('should list with -l flag (detailed)', () => {
      const fileSystem = createMockFileSystem({
        listDirectory: () => success([createFileNode('file1', '/home/kube/file1', 'test')])
      })
      const handler = createLsHandler(fileSystem)
      const result = handler.execute([], { l: true })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('file1')
        // Should contain size and date info
      }
    })

    it('should list specific directory', () => {
      const fileSystem = createMockFileSystem({
        listDirectory: (path?: string) => {
          expect(path).toBe('/home')
          return success([createFileNode('test', '/home/test')])
        }
      })
      const handler = createLsHandler(fileSystem)
      const result = handler.execute(['/home'], {})

      expect(result.ok).toBe(true)
    })

    it('should return error on filesystem error', () => {
      const fileSystem = createMockFileSystem({
        listDirectory: () => error('Directory not found')
      })
      const handler = createLsHandler(fileSystem)
      const result = handler.execute(['/invalid'], {})

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe('Directory not found')
      }
    })

    it('should list multiple specific files (realistic shell behavior)', () => {
      const calls: string[] = []
      const fileSystem = createMockFileSystem({
        listDirectory: (path?: string) => {
          calls.push(path || 'current')
          if (path === 'file1') {
            return success([createFileNode('file1', '/home/kube/file1')])
          }
          if (path === 'file2') {
            return success([createFileNode('file2', '/home/kube/file2')])
          }
          return success([])
        }
      })
      const handler = createLsHandler(fileSystem)
      // Realistic shell behavior: should list all specified files
      const result = handler.execute(['file1', 'file2'], {})

      expect(result.ok).toBe(true)
      // Should list both files
      if (result.ok) {
        expect(result.value).toContain('file1')
        expect(result.value).toContain('file2')
      }
    })

    it('should list multiple files with -l flag (realistic shell behavior)', () => {
      const fileSystem = createMockFileSystem({
        listDirectory: (path?: string) => {
          if (path === 'file1') {
            return success([createFileNode('file1', '/home/kube/file1', 'content1')])
          }
          if (path === 'file2') {
            return success([createFileNode('file2', '/home/kube/file2', 'content2')])
          }
          return success([])
        }
      })
      const handler = createLsHandler(fileSystem)
      // Realistic shell behavior: should list all files with details
      const result = handler.execute(['file1', 'file2'], { l: true })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('file1')
        expect(result.value).toContain('file2')
      }
    })

    it('should list relative path ../dir', () => {
      const fileSystem = createMockFileSystem({
        listDirectory: (path?: string) => {
          expect(path).toBe('../dir')
          return success([createFileNode('test', '/home/kube/test')])
        }
      })
      const handler = createLsHandler(fileSystem)
      const result = handler.execute(['../dir'], {})

      expect(result.ok).toBe(true)
    })

    it('should list current directory with .', () => {
      const fileSystem = createMockFileSystem({
        listDirectory: (path?: string) => {
          expect(path).toBe('.')
          return success([createFileNode('test', '/home/kube/test')])
        }
      })
      const handler = createLsHandler(fileSystem)
      const result = handler.execute(['.'], {})

      expect(result.ok).toBe(true)
    })

    it('should list parent directory with ..', () => {
      const fileSystem = createMockFileSystem({
        listDirectory: (path?: string) => {
          expect(path).toBe('..')
          return success([createFileNode('parent-file', '/home/parent-file')])
        }
      })
      const handler = createLsHandler(fileSystem)
      const result = handler.execute(['..'], {})

      expect(result.ok).toBe(true)
    })

    it('should handle empty directory', () => {
      const fileSystem = createMockFileSystem({
        listDirectory: () => success([])
      })
      const handler = createLsHandler(fileSystem)
      const result = handler.execute([], {})

      expect(result.ok).toBe(true)
      if (result.ok) {
        // Empty directory should return empty string or minimal output
        expect(result.value).toBeDefined()
      }
    })

    it('should handle listing a specific file', () => {
      const fileSystem = createMockFileSystem({
        listDirectory: (path?: string) => {
          // In real shell, ls on a file just lists that file
          return success([createFileNode('file.txt', '/home/kube/file.txt')])
        }
      })
      const handler = createLsHandler(fileSystem)
      const result = handler.execute(['file.txt'], {})

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toContain('file.txt')
      }
    })
  })
})
