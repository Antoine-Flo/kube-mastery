import { describe, expect, it } from 'vitest'
import { createDirectory } from '../../../../src/core/filesystem/models/Directory'
import { createFile } from '../../../../src/core/filesystem/models/File'
import {
  createDirectoryChangedEvent,
  createDirectoryCreatedEvent,
  createDirectoryDeletedEvent,
  createFileCreatedEvent,
  createFileDeletedEvent,
  createFileModifiedEvent,
  type DirectoryChangedEvent,
  type DirectoryCreatedEvent,
  type DirectoryDeletedEvent,
  type FileCreatedEvent,
  type FileDeletedEvent,
  type FileModifiedEvent
} from '../../../../src/core/filesystem/events/types'

describe('Filesystem Event Types', () => {
  const testFile = createFile('test.txt', '/home/test.txt', 'content')
  const testDirectory = createDirectory('test-dir', '/home/test-dir')

  describe('createFileCreatedEvent', () => {
    it('should create FileCreated event with correct structure', () => {
      const event = createFileCreatedEvent(
        testFile,
        '/home/test.txt',
        'filesystem'
      )

      expect(event.type).toBe('FileCreated')
      expect(event.payload.file).toEqual(testFile)
      expect(event.payload.path).toBe('/home/test.txt')
      expect(event.metadata?.source).toBe('filesystem')
      expect(event.timestamp).toBeDefined()
    })

    it('should use default source if not provided', () => {
      const event = createFileCreatedEvent(testFile, '/home/test.txt')

      expect(event.metadata?.source).toBe('filesystem')
    })
  })

  describe('createFileModifiedEvent', () => {
    it('should create FileModified event with correct structure', () => {
      const previousFile = createFile(
        'test.txt',
        '/home/test.txt',
        'old content'
      )
      const updatedFile = createFile(
        'test.txt',
        '/home/test.txt',
        'new content'
      )
      const event = createFileModifiedEvent(
        '/home/test.txt',
        updatedFile,
        previousFile,
        'filesystem'
      )

      expect(event.type).toBe('FileModified')
      expect(event.payload.path).toBe('/home/test.txt')
      expect(event.payload.file).toEqual(updatedFile)
      expect(event.payload.previousFile).toEqual(previousFile)
      expect(event.metadata?.source).toBe('filesystem')
    })
  })

  describe('createFileDeletedEvent', () => {
    it('should create FileDeleted event with correct structure', () => {
      const event = createFileDeletedEvent(
        '/home/test.txt',
        testFile,
        'filesystem'
      )

      expect(event.type).toBe('FileDeleted')
      expect(event.payload.path).toBe('/home/test.txt')
      expect(event.payload.deletedFile).toEqual(testFile)
      expect(event.metadata?.source).toBe('filesystem')
    })
  })

  describe('createDirectoryCreatedEvent', () => {
    it('should create DirectoryCreated event with correct structure', () => {
      const event = createDirectoryCreatedEvent(
        testDirectory,
        '/home/test-dir',
        'filesystem'
      )

      expect(event.type).toBe('DirectoryCreated')
      expect(event.payload.directory).toEqual(testDirectory)
      expect(event.payload.path).toBe('/home/test-dir')
      expect(event.metadata?.source).toBe('filesystem')
    })
  })

  describe('createDirectoryDeletedEvent', () => {
    it('should create DirectoryDeleted event with correct structure', () => {
      const event = createDirectoryDeletedEvent(
        '/home/test-dir',
        testDirectory,
        'filesystem'
      )

      expect(event.type).toBe('DirectoryDeleted')
      expect(event.payload.path).toBe('/home/test-dir')
      expect(event.payload.deletedDirectory).toEqual(testDirectory)
      expect(event.metadata?.source).toBe('filesystem')
    })
  })

  describe('createDirectoryChangedEvent', () => {
    it('should create DirectoryChanged event with correct structure', () => {
      const event = createDirectoryChangedEvent(
        '/home',
        '/home/test',
        'filesystem'
      )

      expect(event.type).toBe('DirectoryChanged')
      expect(event.payload.previousPath).toBe('/home')
      expect(event.payload.currentPath).toBe('/home/test')
      expect(event.metadata?.source).toBe('filesystem')
    })
  })

  describe('event structure', () => {
    it('should have timestamp in ISO format', () => {
      const event = createFileCreatedEvent(testFile, '/home/test.txt')
      const timestamp = new Date(event.timestamp)

      expect(timestamp.getTime()).not.toBeNaN()
    })

    it('should have correlationId in metadata', () => {
      const event = createFileCreatedEvent(testFile, '/home/test.txt')

      expect(event.metadata?.correlationId).toBeDefined()
      expect(typeof event.metadata?.correlationId).toBe('string')
    })
  })
})
