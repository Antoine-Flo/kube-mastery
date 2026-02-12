import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createEventBus,
  type EventBus
} from '../../../src/core/cluster/events/EventBus'
import {
  createFileSystem,
  type FileSystemState
} from '../../../src/core/filesystem/FileSystem'
import { createDirectory } from '../../../src/core/filesystem/models'

describe('FileSystem Mutable Mode', () => {
  let eventBus: EventBus
  let originalState: FileSystemState

  beforeEach(() => {
    eventBus = createEventBus()
    originalState = {
      currentPath: '/home',
      tree: createDirectory('root', '/')
    }
    // Créer une structure de base
    const home = createDirectory('home', '/home')
    originalState.tree.children.set('home', home)
  })

  describe('mutable mode - state sharing', () => {
    it('should modify original state directly in mutable mode', () => {
      const fileSystem = createFileSystem(originalState, eventBus, {
        mutable: true
      })

      // Modifier via FileSystem
      fileSystem.createFile('test.txt', 'content')
      fileSystem.changeDirectory('/home')

      // Vérifier que le state original a été modifié
      expect(originalState.currentPath).toBe('/home')
      const homeDir = originalState.tree.children.get('home')
      expect(homeDir?.type).toBe('directory')
      if (homeDir?.type === 'directory') {
        const testFile = homeDir.children.get('test.txt')
        expect(testFile?.type).toBe('file')
        if (testFile?.type === 'file') {
          expect(testFile.content).toBe('content')
        }
      }
    })

    it('should not modify original state in normal mode', () => {
      const fileSystem = createFileSystem(originalState, eventBus, {
        mutable: false
      })
      const originalPath = originalState.currentPath

      // Modifier via FileSystem
      fileSystem.changeDirectory('/')

      // Vérifier que le state original n'a PAS été modifié
      expect(originalState.currentPath).toBe(originalPath)
    })

    it('should share state reference in mutable mode', () => {
      const fileSystem = createFileSystem(originalState, eventBus, {
        mutable: true
      })

      // Modifier directement le state original
      originalState.currentPath = '/custom'

      // Vérifier que FileSystem voit la modification
      expect(fileSystem.getCurrentPath()).toBe('/custom')
    })

    it('should not share state reference in normal mode after setState', () => {
      const fileSystem = createFileSystem(originalState, eventBus, {
        mutable: false
      })
      const originalPath = originalState.currentPath

      // Modifier via FileSystem (appelle setState qui crée une nouvelle référence)
      fileSystem.changeDirectory('/')

      // Le state original ne devrait pas être modifié
      expect(originalState.currentPath).toBe(originalPath)
      expect(fileSystem.getCurrentPath()).toBe('/')
    })
  })

  describe('mutable mode - toJSON', () => {
    it('should return original state directly in mutable mode (no clone)', () => {
      const fileSystem = createFileSystem(originalState, eventBus, {
        mutable: true
      })

      fileSystem.createFile('test.txt', 'content')
      const json = fileSystem.toJSON()

      // En mode mutable, toJSON retourne directement le state original (même référence)
      expect(json).toBe(originalState)
      // Vérifier que les modifications sont présentes
      const homeDir = json.tree.children.get('home')
      if (homeDir?.type === 'directory') {
        expect(homeDir.children.has('test.txt')).toBe(true)
      }
    })

    it('should return cloned state in normal mode', () => {
      const fileSystem = createFileSystem(originalState, eventBus, {
        mutable: false
      })

      const json = fileSystem.toJSON()

      // En mode normal, toJSON clone le state
      expect(json).not.toBe(originalState)
      expect(json.currentPath).toBe(originalState.currentPath)
      expect(json.tree).not.toBe(originalState.tree) // Différentes références
    })

    it('should reflect mutations in mutable mode toJSON', () => {
      const fileSystem = createFileSystem(originalState, eventBus, {
        mutable: true
      })

      fileSystem.createFile('test.txt', 'content')
      const json = fileSystem.toJSON()

      // Le json devrait avoir le fichier créé
      const homeDir = json.tree.children.get('home')
      expect(homeDir?.type).toBe('directory')
      if (homeDir?.type === 'directory') {
        const testFile = homeDir.children.get('test.txt')
        expect(testFile?.type).toBe('file')
      }
    })
  })

  describe('mutable mode - loadState', () => {
    it('should modify original state directly in mutable mode', () => {
      const fileSystem = createFileSystem(originalState, eventBus, {
        mutable: true
      })

      const newState: FileSystemState = {
        currentPath: '/new',
        tree: createDirectory('root', '/')
      }

      fileSystem.loadState(newState)

      // Le state original devrait être modifié
      expect(originalState.currentPath).toBe('/new')
      expect(originalState.tree).toBe(newState.tree)
    })

    it('should replace internal state in normal mode', () => {
      const fileSystem = createFileSystem(originalState, eventBus, {
        mutable: false
      })
      const originalPath = originalState.currentPath

      const newState: FileSystemState = {
        currentPath: '/new',
        tree: createDirectory('root', '/')
      }

      fileSystem.loadState(newState)

      // Le state original ne devrait PAS être modifié
      expect(originalState.currentPath).toBe(originalPath)
      expect(fileSystem.getCurrentPath()).toBe('/new')
    })
  })

  describe('mutable mode - events', () => {
    it('should emit events correctly in mutable mode', () => {
      const subscriber = vi.fn()
      eventBus.subscribeAll(subscriber)

      const fileSystem = createFileSystem(originalState, eventBus, {
        mutable: true
      })

      fileSystem.createFile('test.txt', 'content')
      fileSystem.writeFile('test.txt', 'new content')
      fileSystem.deleteFile('test.txt')

      expect(subscriber).toHaveBeenCalledTimes(3)
      expect(subscriber.mock.calls[0][0].type).toBe('FileCreated')
      expect(subscriber.mock.calls[1][0].type).toBe('FileModified')
      expect(subscriber.mock.calls[2][0].type).toBe('FileDeleted')
    })
  })

  describe('default behavior (backward compatibility)', () => {
    it('should default to non-mutable mode', () => {
      const fileSystem = createFileSystem(originalState, eventBus)
      const originalPath = originalState.currentPath

      fileSystem.changeDirectory('/')

      // Le state original ne devrait pas être modifié (mode normal par défaut)
      expect(originalState.currentPath).toBe(originalPath)
    })

    it('should create new state if none provided', () => {
      const fileSystem = createFileSystem(undefined, eventBus)

      expect(fileSystem.getCurrentPath()).toBe('/')
      const json = fileSystem.toJSON()
      expect(json.currentPath).toBe('/')
      expect(json.tree.name).toBe('root')
    })
  })
})
