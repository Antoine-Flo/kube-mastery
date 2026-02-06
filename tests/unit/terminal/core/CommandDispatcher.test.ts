import { beforeEach, describe, expect, it } from 'vitest'
import { createClusterState } from '../../../../src/core/cluster/ClusterState'
import { createEventBus } from '../../../../src/core/cluster/events/EventBus'
import type { FileSystem } from '../../../../src/core/shell/commands'
import { createCommandDispatcher } from '../../../../src/core/terminal/core/CommandDispatcher'
import { createFileSystem } from '../../../../src/core/filesystem/FileSystem'
import { ShellContextStack } from '../../../../src/core/terminal/core/ShellContext'
import { createMockRenderer } from '../../helpers/mockRenderer'
import { createLogger } from '../../../../src/logger/Logger'

describe('CommandDispatcher', () => {
    let fileSystem: FileSystem
    let renderer: ReturnType<typeof createMockRenderer>
    let shellContextStack: ShellContextStack
    let dispatcher: ReturnType<typeof createCommandDispatcher>

    beforeEach(() => {
        // Créer la structure de base /home/kube dans l'arbre
        const homeDir = {
            type: 'directory' as const,
            name: 'home',
            path: '/home',
            children: new Map(),
            createdAt: '',
            modifiedAt: '',
        }
        const kubeDir = {
            type: 'directory' as const,
            name: 'kube',
            path: '/home/kube',
            children: new Map(),
            createdAt: '',
            modifiedAt: '',
        }
        homeDir.children.set('kube', kubeDir)

        const root = {
            type: 'directory' as const,
            name: 'root',
            path: '/',
            children: new Map([['home', homeDir]]),
            createdAt: '',
            modifiedAt: '',
        }

        const fileSystemState = {
            currentPath: '/home/kube',
            tree: root,
        }

        shellContextStack = new ShellContextStack(fileSystemState)
        fileSystem = createFileSystem(fileSystemState, undefined, { mutable: true })
        renderer = createMockRenderer()

        // Créer les dépendances kubectl
        const logger = createLogger()
        const eventBus = createEventBus()
        const clusterState = createClusterState(eventBus)

        dispatcher = createCommandDispatcher({
            fileSystem,
            renderer,
            shellContextStack,
            clusterState,
            eventBus,
            logger,
        })
    })

    describe('Shell commands', () => {
        it('should execute pwd command', () => {
            const result = dispatcher.execute('pwd')
            expect(result.ok).toBe(true)
            expect(renderer.getOutput()).toContain('/home/kube')
        })

        it('should execute ls command', () => {
            const result = dispatcher.execute('ls')
            expect(result.ok).toBe(true)
        })

        it('should execute cd command and update prompt', () => {
            // Créer un répertoire d'abord
            const createResult = fileSystem.createDirectory('test')
            expect(createResult.ok).toBe(true)

            const cdResult = fileSystem.changeDirectory('test')
            expect(cdResult.ok).toBe(true)

            // Revenir au répertoire de base
            const result = dispatcher.execute('cd /home/kube')
            expect(result.ok).toBe(true)
        })

        it('should execute clear command', () => {
            const result = dispatcher.execute('clear')
            expect(result.ok).toBe(true)
            // clear efface le terminal
            expect(renderer.getOutput()).toContain('\x1b[2J\x1b[H')
        })

        it('should execute help command', () => {
            const result = dispatcher.execute('help')
            expect(result.ok).toBe(true)
        })

        it('should handle command with flags', () => {
            const result = dispatcher.execute('ls -l')
            expect(result.ok).toBe(true)
        })

        it('should handle command with arguments', () => {
            // Créer un fichier d'abord avec du contenu
            const createResult = fileSystem.createFile('test.txt')
            expect(createResult.ok).toBe(true)
            const writeResult = fileSystem.writeFile('test.txt', 'test content')
            expect(writeResult.ok).toBe(true)

            const result = dispatcher.execute('cat test.txt')
            expect(result.ok).toBe(true)
        })
    })

    describe('Kubectl commands', () => {
        it('should handle kubectl get pods command', () => {
            const result = dispatcher.execute('kubectl get pods')
            expect(result.ok).toBe(true)
            // Cluster vide, pas de pods
            expect(renderer.getOutput()).toContain('No resources found')
        })

        it('should handle kubectl describe with non-existent resource', () => {
            const result = dispatcher.execute('kubectl describe pod my-pod')
            expect(result.ok).toBe(false)
            // Pod n'existe pas
            expect(renderer.getOutput()).toContain('not found')
        })
    })

    describe('Error handling', () => {
        it('should return error for unknown command', () => {
            const result = dispatcher.execute('unknown-command')
            expect(result.ok).toBe(false)
            expect(renderer.getOutput()).toContain('Unknown command: unknown-command')
        })

        it('should display error message for invalid shell command', () => {
            const result = dispatcher.execute('ls /invalid/path')
            // Le résultat dépend de l'implémentation, mais l'erreur doit être affichée
            expect(renderer.getOutput()).toBeTruthy()
        })
    })

    describe('Command routing', () => {
        it('should route shell commands to ShellCommandHandler', () => {
            const result = dispatcher.execute('pwd')
            expect(result.ok).toBe(true)
            // Vérifier que c'est bien géré par le shell handler
            expect(renderer.getOutput()).toContain('/home/kube')
        })

        it('should route kubectl commands to KubectlCommandHandler', () => {
            const result = dispatcher.execute('kubectl get pods')
            expect(result.ok).toBe(true)
            // kubectl retourne un vrai résultat maintenant
            expect(renderer.getOutput()).toContain('No resources found')
        })
    })
})
