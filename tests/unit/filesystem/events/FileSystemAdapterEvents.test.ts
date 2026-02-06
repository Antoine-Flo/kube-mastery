import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEventBus, type EventBus } from '../../../../src/core/cluster/events/EventBus'
import { createFileSystem } from '../../../../src/core/filesystem/FileSystem'
import { createDirectory } from '../../../../src/core/filesystem/models'
import type { FileSystemState } from '../../../../src/core/filesystem/FileSystem'

describe('FileSystem Mutable Mode Events Integration', () => {
    let eventBus: EventBus
    let fileSystemState: FileSystemState
    let fileSystem: ReturnType<typeof createFileSystem>

    beforeEach(() => {
        eventBus = createEventBus()
        fileSystemState = {
            currentPath: '/home',
            tree: createDirectory('root', '/'),
        }
        // Create initial structure
        const root = fileSystemState.tree
        const home = createDirectory('home', '/home')
        root.children.set('home', home)

        fileSystem = createFileSystem(fileSystemState, eventBus, { mutable: true })
    })

    describe('createFile emits FileCreated event', () => {
        it('should emit FileCreated event when file is created', () => {
            const subscriber = vi.fn()
            eventBus.subscribe('FileCreated', subscriber)

            const result = fileSystem.createFile('test.txt', 'content')

            expect(result.ok).toBe(true)
            expect(subscriber).toHaveBeenCalledTimes(1)

            const event = subscriber.mock.calls[0][0]
            expect(event.type).toBe('FileCreated')
            expect(event.payload.file.name).toBe('test.txt')
            expect(event.metadata?.source).toBe('filesystem')
        })
    })

    describe('writeFile emits FileModified event', () => {
        it('should emit FileModified event when file is written', () => {
            const subscriber = vi.fn()
            eventBus.subscribe('FileModified', subscriber)

            // Create file first
            fileSystem.createFile('test.txt', 'old content')

            // Write to file
            const result = fileSystem.writeFile('test.txt', 'new content')

            expect(result.ok).toBe(true)
            expect(subscriber).toHaveBeenCalledTimes(1)

            const event = subscriber.mock.calls[0][0]
            expect(event.type).toBe('FileModified')
            expect(event.payload.file.content).toBe('new content')
        })

        it('should emit FileCreated if file does not exist (writeFile creates file)', () => {
            const createdSubscriber = vi.fn()
            const modifiedSubscriber = vi.fn()
            eventBus.subscribe('FileCreated', createdSubscriber)
            eventBus.subscribe('FileModified', modifiedSubscriber)

            const result = fileSystem.writeFile('newfile.txt', 'content')

            // writeFile creates file if it doesn't exist
            expect(result.ok).toBe(true)
            expect(createdSubscriber).toHaveBeenCalledTimes(1)
            expect(modifiedSubscriber).not.toHaveBeenCalled()
        })
    })

    describe('deleteFile emits FileDeleted event', () => {
        it('should emit FileDeleted event when file is deleted', () => {
            const subscriber = vi.fn()
            eventBus.subscribe('FileDeleted', subscriber)

            // Create file first
            fileSystem.createFile('test.txt', 'content')

            // Delete file
            const result = fileSystem.deleteFile('test.txt')

            expect(result.ok).toBe(true)
            expect(subscriber).toHaveBeenCalledTimes(1)

            const event = subscriber.mock.calls[0][0]
            expect(event.type).toBe('FileDeleted')
            expect(event.payload.deletedFile.name).toBe('test.txt')
        })
    })

    describe('createDirectory emits DirectoryCreated event', () => {
        it('should emit DirectoryCreated event when directory is created', () => {
            const subscriber = vi.fn()
            eventBus.subscribe('DirectoryCreated', subscriber)

            const result = fileSystem.createDirectory('test-dir')

            expect(result.ok).toBe(true)
            expect(subscriber).toHaveBeenCalledTimes(1)

            const event = subscriber.mock.calls[0][0]
            expect(event.type).toBe('DirectoryCreated')
        })
    })

    describe('changeDirectory emits DirectoryChanged event', () => {
        it('should emit DirectoryChanged event when directory changes', () => {
            const subscriber = vi.fn()
            eventBus.subscribe('DirectoryChanged', subscriber)

            // Create and navigate to directory
            fileSystem.createDirectory('test-dir')
            const result = fileSystem.changeDirectory('test-dir')

            expect(result.ok).toBe(true)
            expect(subscriber).toHaveBeenCalledTimes(1)

            const event = subscriber.mock.calls[0][0]
            expect(event.type).toBe('DirectoryChanged')
            expect(event.payload.previousPath).toBe('/home')
            expect(event.payload.currentPath).toContain('test-dir')
        })

        it('should not emit event if path does not change', () => {
            const subscriber = vi.fn()
            eventBus.subscribe('DirectoryChanged', subscriber)

            // Change to current directory
            fileSystem.changeDirectory('.')

            expect(subscriber).not.toHaveBeenCalled()
        })
    })
})

