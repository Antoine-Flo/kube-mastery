// ═══════════════════════════════════════════════════════════════════════════
// SHELL CONTEXT STACK
// ═══════════════════════════════════════════════════════════════════════════
// Gestion des contextes shell (host/container) + filesystem + prompt

import type { FileSystemState } from '../../../core/filesystem/FileSystem'

// Type minimal pour FileSystem (utilisé par ShellContextStack)
export interface FileSystem {
  getCurrentPath(): string
}

// Factory function pour créer un filesystem minimal (temporaire)
const createFileSystem = (state: FileSystemState): FileSystem => {
  return {
    getCurrentPath: () => state.currentPath || '/home/kube'
  }
}

interface ShellContext {
  id: string
  type: 'host' | 'container'
  podName?: string
  containerName?: string
  namespace?: string
  fileSystem: FileSystem
  prompt: string
}

export class ShellContextStack {
  private contexts: ShellContext[] = []
  private currentIndex = 0

  constructor(hostFileSystem: FileSystemState) {
    // Initialiser avec le contexte host
    this.contexts.push({
      id: 'host',
      type: 'host',
      fileSystem: createFileSystem(hostFileSystem),
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
      fileSystem: createFileSystem(containerFileSystem),
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
}
