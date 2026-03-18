// ═══════════════════════════════════════════════════════════════════════════
// SHELL CONTEXT STACK
// ═══════════════════════════════════════════════════════════════════════════
// Gestion des contextes shell (host/container) + filesystem + prompt

import {
  createFileSystem,
  type FileSystem,
  type FileSystemState
} from '../../filesystem/FileSystem'

interface ShellContext {
  id: string
  type: 'host' | 'container'
  podName?: string
  containerName?: string
  namespace?: string
  fileSystem: FileSystem
  prompt: string
}

export interface ContainerShellContextInfo {
  podName: string
  containerName: string
  namespace: string
}

export class ShellContextStack {
  private contexts: ShellContext[] = []
  private currentIndex = 0

  constructor(hostFileSystem: FileSystemState) {
    // Initialiser avec le contexte host
    this.contexts.push({
      id: 'host',
      type: 'host',
      fileSystem: createFileSystem(hostFileSystem, undefined, { mutable: true }),
      prompt: '~>'
    })
  }

  getCurrentContext(): ShellContext {
    return this.contexts[this.currentIndex]
  }

  pushContainerContext(
    podName: string,
    containerName: string,
    namespace: string,
    containerFileSystem: FileSystemState
  ): void {
    const context: ShellContext = {
      id: `container-${podName}-${containerName}`,
      type: 'container',
      podName,
      containerName,
      namespace,
      fileSystem: createFileSystem(containerFileSystem, undefined, {
        mutable: true
      }),
      prompt: `[${podName}:${containerName}] />`
    }

    this.contexts.push(context)
    this.currentIndex = this.contexts.length - 1
  }

  popContext(): boolean {
    if (this.contexts.length <= 1) {
      return false // Ne peut pas quitter le contexte host
    }

    this.contexts.pop()
    this.currentIndex = this.contexts.length - 1
    return true
  }

  updateCurrentPrompt(): void {
    const context = this.getCurrentContext()
    const currentPath = context.fileSystem.getCurrentPath()

    if (context.type === 'host') {
      if (currentPath === '/home/kube') {
        context.prompt = '~>'
      } else if (currentPath.startsWith('/home/kube/')) {
        const relativePath = currentPath.substring('/home/kube/'.length)
        context.prompt = `~/${relativePath}>`
      } else {
        context.prompt = `${currentPath}>`
      }
    } else {
      // Container context
      if (currentPath === '/') {
        context.prompt = `[${context.podName}:${context.containerName}] />`
      } else {
        const relativePath = currentPath.substring(1) // Remove leading /
        context.prompt = `[${context.podName}:${context.containerName}] /${relativePath}>`
      }
    }
  }

  isInContainer(): boolean {
    return this.getCurrentContext().type === 'container'
  }

  getCurrentFileSystem(): FileSystem {
    return this.getCurrentContext().fileSystem
  }

  getCurrentPrompt(): string {
    return this.getCurrentContext().prompt
  }

  getCurrentContainerInfo(): ContainerShellContextInfo | undefined {
    const context = this.getCurrentContext()
    if (context.type !== 'container') {
      return undefined
    }
    if (
      context.podName == null ||
      context.containerName == null ||
      context.namespace == null
    ) {
      return undefined
    }
    return {
      podName: context.podName,
      containerName: context.containerName,
      namespace: context.namespace
    }
  }
}
