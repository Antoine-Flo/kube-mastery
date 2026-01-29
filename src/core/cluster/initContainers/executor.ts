// ═══════════════════════════════════════════════════════════════════════════
// INIT CONTAINER EXECUTOR
// ═══════════════════════════════════════════════════════════════════════════
// Simulates command execution for init containers
// Supports basic commands: touch, mkdir, echo redirect, sh -c

import { createFileSystem, type FileSystemState } from '../../filesystem/FileSystem'
import { error, success, type Result } from '../../shared/result'
import type { Container } from '../ressources/Pod'

// ─── Command Parsing ─────────────────────────────────────────────────────

/**
 * Parse command and args into a normalized command string
 */
const parseCommand = (container: Container): string | null => {
    if (!container.command || container.command.length === 0) {
        return null
    }

    const cmd = container.command[0]
    const args = container.args || []

    return `${cmd} ${args.join(' ')}`.trim()
}

/**
 * Extract script from sh -c args
 */
const extractShScript = (args: string[]): string | null => {
    // sh -c "script" format
    const cIndex = args.indexOf('-c')
    if (cIndex !== -1 && cIndex + 1 < args.length) {
        return args[cIndex + 1]
    }
    return null
}

/**
 * Normalize path to absolute path
 */
const normalizePath = (path: string): string => {
    if (path.startsWith('/')) {
        return path
    }
    return `/${path}`
}

// ─── Command Executors ───────────────────────────────────────────────────

/**
 * Execute touch command - creates empty file
 */
const executeTouchCommand = (fs: ReturnType<typeof createFileSystem>, path: string): Result<void> => {
    const normalizedPath = normalizePath(path)
    const result = fs.createFile(normalizedPath, '')

    if (!result.ok) {
        return error(result.error)
    }

    return success(undefined)
}

/**
 * Execute mkdir command - creates directory
 */
const executeMkdirCommand = (
    fs: ReturnType<typeof createFileSystem>,
    args: string[]
): Result<void> => {
    // Check for -p flag
    const hasParentFlag = args.includes('-p')
    const pathIndex = hasParentFlag ? args.indexOf('-p') + 1 : 0

    if (pathIndex >= args.length) {
        return error('mkdir: missing operand')
    }

    const path = args[pathIndex]
    const normalizedPath = normalizePath(path)

    // If -p flag, create parent directories one by one
    if (hasParentFlag) {
        const parts = normalizedPath.split('/').filter(p => p.length > 0)
        let currentPath = ''

        for (const part of parts) {
            currentPath += `/${part}`
            // Try to create directory, ignore error if already exists
            const result = fs.createDirectory(currentPath)
            if (!result.ok && !result.error.includes('already exists')) {
                return error(result.error)
            }
        }

        return success(undefined)
    }

    // Without -p, try to create directory directly
    const result = fs.createDirectory(normalizedPath)

    if (!result.ok) {
        return error(result.error)
    }

    return success(undefined)
}

/**
 * Execute echo redirect command - creates file with content
 */
const executeEchoRedirect = (fs: ReturnType<typeof createFileSystem>, fullCommand: string): Result<void> => {
    // Parse: echo "content" > /path/to/file
    const redirectMatch = fullCommand.match(/echo\s+["']?([^"'>]+)["']?\s+>\s+(\S+)/)

    if (!redirectMatch) {
        return error('Invalid echo redirect syntax')
    }

    const content = redirectMatch[1].trim()
    const path = redirectMatch[2].trim()
    const normalizedPath = normalizePath(path)

    const result = fs.createFile(normalizedPath, content)

    if (!result.ok) {
        return error(result.error)
    }

    return success(undefined)
}

/**
 * Execute chained commands (separated by &&)
 */
const executeChainedCommands = (fs: ReturnType<typeof createFileSystem>, fullCommand: string): Result<void> => {
    const commands = fullCommand.split('&&').map(cmd => cmd.trim())

    for (const cmd of commands) {
        const result = executeSingleCommand(fs, cmd)
        if (!result.ok) {
            return result
        }
    }

    return success(undefined)
}

/**
 * Execute a single command
 */
const executeSingleCommand = (fs: ReturnType<typeof createFileSystem>, command: string): Result<void> => {
    const trimmedCommand = command.trim()

    // Echo redirect
    if (trimmedCommand.includes('echo') && trimmedCommand.includes('>')) {
        return executeEchoRedirect(fs, trimmedCommand)
    }

    // Touch
    if (trimmedCommand.startsWith('touch ')) {
        const path = trimmedCommand.replace('touch', '').trim()
        return executeTouchCommand(fs, path)
    }

    // Mkdir
    if (trimmedCommand.startsWith('mkdir ')) {
        const args = trimmedCommand.replace('mkdir', '').trim().split(/\s+/)
        return executeMkdirCommand(fs, args)
    }

    return error(`Unsupported command: ${trimmedCommand.split(' ')[0]}`)
}

// ─── Main Executor ───────────────────────────────────────────────────────

/**
 * Execute init container commands and return modified filesystem
 * Pure function that simulates command execution
 */
export const executeInitContainer = (
    container: Container,
    filesystem: FileSystemState
): Result<FileSystemState> => {
    const commandStr = parseCommand(container)

    // No command = no-op (success)
    if (!commandStr) {
        return success(filesystem)
    }

    const fs = createFileSystem(filesystem)

    // Handle sh -c "command"
    if (container.command && container.command[0] === 'sh' && container.args) {
        const script = extractShScript(container.args)
        if (!script) {
            return error('Invalid sh -c syntax')
        }

        // Check for chained commands
        if (script.includes('&&')) {
            const result = executeChainedCommands(fs, script)
            if (!result.ok) {
                return error(result.error)
            }
        } else {
            const result = executeSingleCommand(fs, script)
            if (!result.ok) {
                return error(result.error)
            }
        }

        return success(fs.toJSON())
    }

    // Direct command execution
    const result = executeSingleCommand(fs, commandStr)
    if (!result.ok) {
        return error(result.error)
    }

    return success(fs.toJSON())
}

