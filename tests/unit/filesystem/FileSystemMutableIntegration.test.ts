import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEventBus, type EventBus } from '../../../src/core/cluster/events/EventBus'
import { createFileSystem } from '../../../src/core/filesystem/FileSystem'
import { createDirectory, createFile } from '../../../src/core/filesystem/models'
import type { FileSystemState } from '../../../src/core/filesystem/FileSystem'

describe('FileSystem Mutable Mode - Integration Tests', () => {
    let eventBus: EventBus
    let fileSystemState: FileSystemState

    beforeEach(() => {
        eventBus = createEventBus()
        fileSystemState = {
            currentPath: '/home',
            tree: createDirectory('root', '/'),
        }
        // Créer une structure de base
        const home = createDirectory('home', '/home')
        fileSystemState.tree.children.set('home', home)
    })

    describe('state sharing with original', () => {
        it('should modify original state directly', () => {
            const fileSystem = createFileSystem(fileSystemState, eventBus, { mutable: true })
            const originalPath = fileSystemState.currentPath

            fileSystem.createFile('test.txt', 'content')
            fileSystem.changeDirectory('/')

            // Le state original devrait être modifié
            expect(fileSystemState.currentPath).toBe('/')
            expect(fileSystemState.currentPath).not.toBe(originalPath)

            const homeDir = fileSystemState.tree.children.get('home')
            expect(homeDir?.type).toBe('directory')
            if (homeDir?.type === 'directory') {
                const testFile = homeDir.children.get('test.txt')
                expect(testFile?.type).toBe('file')
            }
        })

        it('should reflect direct state mutations', () => {
            const fileSystem = createFileSystem(fileSystemState, eventBus, { mutable: true })

            // Modifier directement le state
            fileSystemState.currentPath = '/custom'

            // FileSystem devrait voir la modification
            expect(fileSystem.getCurrentPath()).toBe('/custom')
        })

        it('should share tree mutations', () => {
            const fileSystem = createFileSystem(fileSystemState, eventBus, { mutable: true })

            // Créer un fichier via FileSystem
            fileSystem.createFile('test.txt', 'content')

            // Modifier directement le tree
            const homeDir = fileSystemState.tree.children.get('home')
            if (homeDir?.type === 'directory') {
                const directFile = createFile('direct.txt', '/home/direct.txt', 'direct')
                homeDir.children.set('direct.txt', directFile)
            }

            // FileSystem devrait voir les deux fichiers
            const listResult = fileSystem.listDirectory()
            expect(listResult.ok).toBe(true)
            if (listResult.ok) {
                const files = listResult.value.filter(n => n.type === 'file')
                expect(files.length).toBe(2)
                expect(files.some(f => f.name === 'test.txt')).toBe(true)
                expect(files.some(f => f.name === 'direct.txt')).toBe(true)
            }
        })
    })

    describe('toJSON returns original state', () => {
        it('should return original state reference (no clone)', () => {
            const fileSystem = createFileSystem(fileSystemState, eventBus, { mutable: true })

            fileSystem.createFile('test.txt', 'content')
            const json = fileSystem.toJSON()

            // toJSON devrait retourner directement le state original (même référence)
            expect(json).toBe(fileSystemState)
            // Vérifier que les modifications sont présentes
            const homeDir = json.tree.children.get('home')
            if (homeDir?.type === 'directory') {
                expect(homeDir.children.has('test.txt')).toBe(true)
            }
        })

        it('should reflect all mutations in toJSON', () => {
            const fileSystem = createFileSystem(fileSystemState, eventBus, { mutable: true })

            fileSystem.createFile('test1.txt', 'content1')
            fileSystem.createFile('test2.txt', 'content2')
            fileSystem.changeDirectory('/')

            const json = fileSystem.toJSON()

            expect(json.currentPath).toBe('/')
            const homeDir = json.tree.children.get('home')
            expect(homeDir?.type).toBe('directory')
            if (homeDir?.type === 'directory') {
                expect(homeDir.children.has('test1.txt')).toBe(true)
                expect(homeDir.children.has('test2.txt')).toBe(true)
            }
        })
    })

    describe('loadState modifies original', () => {
        it('should modify original state when loading new state', () => {
            const fileSystem = createFileSystem(fileSystemState, eventBus, { mutable: true })

            const newState: FileSystemState = {
                currentPath: '/new',
                tree: createDirectory('root', '/'),
            }
            const newHome = createDirectory('home', '/new/home')
            newState.tree.children.set('home', newHome)

            fileSystem.loadState(newState)

            // Le state original devrait être modifié
            expect(fileSystemState.currentPath).toBe('/new')
            expect(fileSystemState.tree).toBe(newState.tree)
            expect(fileSystem.getCurrentPath()).toBe('/new')
        })

        it('should preserve state reference after loadState', () => {
            const fileSystem = createFileSystem(fileSystemState, eventBus, { mutable: true })
            const originalReference = fileSystemState

            const newState: FileSystemState = {
                currentPath: '/new',
                tree: createDirectory('root', '/'),
            }

            fileSystem.loadState(newState)

            // La référence de l'objet devrait être la même
            expect(fileSystemState).toBe(originalReference)
            // Le tree devrait être la même référence (modifié directement)
            expect(fileSystemState.tree).toBe(newState.tree)
            // toJSON devrait retourner la même référence
            const json = fileSystem.toJSON()
            expect(json).toBe(originalReference)
            expect(json.tree).toBe(newState.tree)
        })
    })

    describe('events with state mutations', () => {
        it('should emit events when modifying shared state', () => {
            const subscriber = vi.fn()
            eventBus.subscribeAll(subscriber)

            const fileSystem = createFileSystem(fileSystemState, eventBus, { mutable: true })

            fileSystem.createFile('test.txt', 'content')
            fileSystem.writeFile('test.txt', 'new content')
            fileSystem.deleteFile('test.txt')

            expect(subscriber).toHaveBeenCalledTimes(3)
            expect(subscriber.mock.calls[0][0].type).toBe('FileCreated')
            expect(subscriber.mock.calls[1][0].type).toBe('FileModified')
            expect(subscriber.mock.calls[2][0].type).toBe('FileDeleted')
        })

        it('should emit events that reflect actual state changes', () => {
            const createdSubscriber = vi.fn()
            eventBus.subscribe('FileCreated', createdSubscriber)

            const fileSystem = createFileSystem(fileSystemState, eventBus, { mutable: true })

            fileSystem.createFile('test.txt', 'content')

            // Vérifier que l'événement contient les bonnes données
            expect(createdSubscriber).toHaveBeenCalledTimes(1)
            const event = createdSubscriber.mock.calls[0][0]
            expect(event.payload.file.name).toBe('test.txt')
            expect(event.payload.file.content).toBe('content')

            // Vérifier que le fichier existe bien dans le state
            const homeDir = fileSystemState.tree.children.get('home')
            if (homeDir?.type === 'directory') {
                const testFile = homeDir.children.get('test.txt')
                expect(testFile?.type).toBe('file')
                if (testFile?.type === 'file') {
                    expect(testFile.content).toBe('content')
                }
            }
        })
    })

    describe('multiple adapters on same state', () => {
        it('should share state between multiple adapters', () => {
            const adapter1 = createFileSystem(fileSystemState, eventBus, { mutable: true })
            const adapter2 = createFileSystem(fileSystemState, eventBus, { mutable: true })

            // Modifier via adapter1 (créer dans /home)
            adapter1.createFile('test1.txt', 'content1')
            // Rester dans /home pour voir le fichier
            adapter1.changeDirectory('/home')

            // Adapter2 devrait voir les modifications
            expect(adapter2.getCurrentPath()).toBe('/home')
            const listResult = adapter2.listDirectory()
            expect(listResult.ok).toBe(true)
            if (listResult.ok) {
                const files = listResult.value.filter(n => n.type === 'file')
                expect(files.length).toBe(1)
                if (files[0]?.type === 'file') {
                    expect(files[0].name).toBe('test1.txt')
                }
            }
        })

        it('should emit events from all adapters', () => {
            const subscriber = vi.fn()
            eventBus.subscribeAll(subscriber)

            const adapter1 = createFileSystem(fileSystemState, eventBus, { mutable: true })
            const adapter2 = createFileSystem(fileSystemState, eventBus, { mutable: true })

            adapter1.createFile('file1.txt', 'content1')
            adapter2.createFile('file2.txt', 'content2')

            expect(subscriber).toHaveBeenCalledTimes(2)
        })
    })
})

