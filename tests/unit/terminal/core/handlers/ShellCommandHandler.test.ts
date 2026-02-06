import { beforeEach, describe, expect, it } from 'vitest'
import { createClusterState } from '../../../../../src/core/cluster/ClusterState'
import { createEventBus } from '../../../../../src/core/cluster/events/EventBus'
import type { CommandContext } from '../../../../../src/core/terminal/core/CommandContext'
import { createFileSystem } from '../../../../../src/core/filesystem/FileSystem'
import { ShellCommandHandler } from '../../../../../src/core/terminal/core/handlers/ShellCommandHandler'
import { ShellContextStack } from '../../../../../src/core/terminal/core/ShellContext'
import { createTerminalOutput } from '../../../../../src/core/terminal/core/TerminalOutput'
import { createMockRenderer } from '../../../helpers/mockRenderer'
import { createLogger } from '../../../../../src/logger/Logger'

describe('ShellCommandHandler', () => {
    let handler: ShellCommandHandler
    let context: CommandContext
    let renderer: ReturnType<typeof createMockRenderer>
    let shellContextStack: ShellContextStack

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
        const fileSystem = createFileSystem(fileSystemState, undefined, { mutable: true })
        renderer = createMockRenderer()
        const eventBus = createEventBus()
        const clusterState = createClusterState(eventBus)
        const logger = createLogger()

        context = {
            fileSystem,
            renderer,
            output: createTerminalOutput(renderer),
            shellContextStack,
            clusterState,
            eventBus,
            logger,
        }

        handler = new ShellCommandHandler()
    })

    describe('canHandle', () => {
        it('should return true for valid shell commands', () => {
            expect(handler.canHandle('pwd')).toBe(true)
            expect(handler.canHandle('ls')).toBe(true)
            expect(handler.canHandle('cd /home')).toBe(true)
            expect(handler.canHandle('cat file.txt')).toBe(true)
            expect(handler.canHandle('mkdir test')).toBe(true)
            expect(handler.canHandle('touch file.txt')).toBe(true)
            expect(handler.canHandle('rm file.txt')).toBe(true)
            expect(handler.canHandle('clear')).toBe(true)
            expect(handler.canHandle('help')).toBe(true)
            expect(handler.canHandle('nano file.txt')).toBe(true)
        })

        it('should return false for invalid commands', () => {
            expect(handler.canHandle('kubectl get pods')).toBe(false)
            expect(handler.canHandle('unknown-command')).toBe(false)
            expect(handler.canHandle('')).toBe(false)
        })

        it('should return true for commands with flags (parser accepts all flags)', () => {
            // Le parser accepte tous les flags, même s'ils ne sont pas reconnus par la commande
            // C'est le comportement shell standard
            expect(handler.canHandle('ls -invalid-flag')).toBe(true)
        })
    })

    describe('execute', () => {
        it('should execute pwd command', () => {
            const result = handler.execute('pwd', context)
            expect(result.ok).toBe(true)
            expect(renderer.getOutput()).toContain('/home/kube')
        })

        it('should execute ls command', () => {
            const result = handler.execute('ls', context)
            expect(result.ok).toBe(true)
        })

        it('should execute cd command and update prompt', () => {
            // Créer un répertoire d'abord
            context.fileSystem.createDirectory('test')
            context.fileSystem.changeDirectory('test')

            const result = handler.execute('cd /home/kube', context)
            expect(result.ok).toBe(true)
            // Le prompt doit être mis à jour
            expect(shellContextStack.getCurrentFileSystem().getCurrentPath()).toBe('/home/kube')
        })

        it('should execute clear command and clear terminal', () => {
            const result = handler.execute('clear', context)
            expect(result.ok).toBe(true)
            expect(renderer.getOutput()).toContain('\x1b[2J\x1b[H')
        })

        it('should execute help command', () => {
            const result = handler.execute('help', context)
            expect(result.ok).toBe(true)
            expect(renderer.getOutput().length).toBeGreaterThan(0)
        })

        it('should handle commands with flags', () => {
            const result = handler.execute('ls -l', context)
            expect(result.ok).toBe(true)
        })

        it('should handle commands with arguments', () => {
            context.fileSystem.createFile('test.txt')
            const result = handler.execute('cat test.txt', context)
            expect(result.ok).toBe(true)
        })

        it('should return error for invalid command', () => {
            // canHandle retourne false pour les commandes invalides, donc execute n'est pas appelé
            // Mais si on force l'exécution, le parser retourne une erreur
            const result = handler.execute('invalid-command', context)
            expect(result.ok).toBe(false)
            // L'erreur est affichée dans le renderer
            expect(renderer.getOutput()).toContain('Error:')
        })

        it('should display error message when command fails', () => {
            const result = handler.execute('cd /invalid/path', context)
            expect(result.ok).toBe(false)
            expect(renderer.getOutput()).toContain('Error:')
        })

        it('should not update prompt for non-cd commands', () => {
            const initialPath = shellContextStack.getCurrentFileSystem().getCurrentPath()
            handler.execute('pwd', context)
            expect(shellContextStack.getCurrentFileSystem().getCurrentPath()).toBe(initialPath)
        })
    })
})
