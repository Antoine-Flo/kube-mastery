import { stringify as yamlStringify } from 'yaml'
import type { ParsedCommand } from '../types'
import type { Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'

// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL VERSION HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Displays kubectl client and server version information
// Matches the format of real kubectl version output

// ─── Types ───────────────────────────────────────────────────────────────

interface VersionInfo {
    major: string
    minor: string
    gitVersion: string
    gitCommit: string
    gitTreeState: string
    buildDate: string
    goVersion: string
    compiler: string
    platform: string
}

interface ServerVersionInfo extends VersionInfo {
    emulationMajor?: string
    emulationMinor?: string
    minCompatibilityMajor?: string
    minCompatibilityMinor?: string
}

interface Version {
    clientVersion: VersionInfo
    kustomizeVersion: string
    serverVersion?: ServerVersionInfo
}

// ─── Version Data ────────────────────────────────────────────────────────

const CLIENT_VERSION: VersionInfo = {
    major: '1',
    minor: '35',
    gitVersion: 'v1.35.0',
    gitCommit: '66452049f3d692768c39c797b21b793dce80314e',
    gitTreeState: 'clean',
    buildDate: '<timestamp>',
    goVersion: 'go1.25.5',
    compiler: 'gc',
    platform: 'linux/amd64',
}

const SERVER_VERSION: ServerVersionInfo = {
    major: '1',
    minor: '35',
    gitVersion: 'v1.35.0',
    gitCommit: '66452049f3d692768c39c797b21b793dce80314e',
    gitTreeState: 'clean',
    buildDate: '<timestamp>',
    goVersion: 'go1.25.5',
    compiler: 'gc',
    platform: 'linux/amd64',
    emulationMajor: '1',
    emulationMinor: '35',
    minCompatibilityMajor: '1',
    minCompatibilityMinor: '34',
}

const KUSTOMIZE_VERSION = 'v5.7.1'

// ─── Formatting Functions ────────────────────────────────────────────────

/**
 * Format version in simple text format (default output)
 * Matches kubectl format: "Client Version: v1.35.0"
 */
const formatSimpleOutput = (version: Version): string => {
    const lines: string[] = []
    lines.push(`Client Version: ${version.clientVersion.gitVersion}`)
    lines.push(`Kustomize Version: ${version.kustomizeVersion}`)
    if (version.serverVersion) {
        lines.push(`Server Version: ${version.serverVersion.gitVersion}`)
    }
    return lines.join('\n')
}

/**
 * Format version as JSON
 */
const formatJsonOutput = (version: Version): string => {
    return JSON.stringify(version, null, 2)
}

/**
 * Format version as YAML
 */
const formatYamlOutput = (version: Version): string => {
    return yamlStringify(version)
}

/**
 * Handle kubectl version command
 * Supports:
 * - kubectl version (client + kustomize + server)
 * - kubectl version --client (client + kustomize only)
 * - kubectl version --output json (JSON format)
 * - kubectl version --output yaml (YAML format)
 */
export const handleVersion = (parsed: ParsedCommand): Result<string> => {
    // Get output format - check flags first (explicit), then parsed.output (may be default 'table')
    const explicitOutput = parsed.flags.output || parsed.flags['o']
    const outputFormat = explicitOutput ? (explicitOutput as string) : parsed.output

    // Validate --output flag (following Go implementation: if Output != "" && != "yaml" && != "json" -> error)
    // parsed.output can be 'table' (default from parser) - we only validate if it's explicitly set to something else
    if (parsed.output && parsed.output !== 'table' && parsed.output !== 'yaml' && parsed.output !== 'json') {
        return error(`--output must be 'yaml' or 'json'`)
    }
    // Also validate explicit flags
    if (explicitOutput && explicitOutput !== 'yaml' && explicitOutput !== 'json') {
        return error(`--output must be 'yaml' or 'json'`)
    }

    const clientFlag = parsed.flags.client ?? parsed.flags['client']
    const clientOnly = typeof clientFlag === 'boolean' && clientFlag === true

    // Build version object
    const version: Version = {
        clientVersion: CLIENT_VERSION,
        kustomizeVersion: KUSTOMIZE_VERSION,
    }

    // Add server version only if --client is not used
    if (!clientOnly) {
        version.serverVersion = SERVER_VERSION
    }

    // Format output based on --output flag
    if (outputFormat === 'json') {
        return success(formatJsonOutput(version))
    }

    if (outputFormat === 'yaml') {
        return success(formatYamlOutput(version))
    }

    // Default: simple text format (when outputFormat is undefined or not specified)
    return success(formatSimpleOutput(version))
}
