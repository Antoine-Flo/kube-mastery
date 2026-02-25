import type {
  LifecycleCommandConfig,
  LifecycleSegment
} from './scenario-generator'

export type KubectlCommandName =
  | 'annotate'
  | 'api-resources'
  | 'api-versions'
  | 'apply'
  | 'cluster-info'
  | 'config'
  | 'create'
  | 'delete'
  | 'describe'
  | 'diff'
  | 'exec'
  | 'explain'
  | 'get'
  | 'help'
  | 'label'
  | 'logs'
  | 'run'
  | 'scale'
  | 'version'

const KNOWN_COMMANDS = new Set<KubectlCommandName>([
  'annotate',
  'api-resources',
  'api-versions',
  'apply',
  'cluster-info',
  'config',
  'create',
  'delete',
  'describe',
  'diff',
  'exec',
  'explain',
  'get',
  'help',
  'label',
  'logs',
  'run',
  'scale',
  'version'
])

export const normalizeKubectlCommandName = (
  value: string
): KubectlCommandName | undefined => {
  if (KNOWN_COMMANDS.has(value as KubectlCommandName)) {
    return value as KubectlCommandName
  }
  return undefined
}

const getCommandText = (
  commandInput: string | LifecycleCommandConfig
): string => {
  if (typeof commandInput === 'string') {
    return commandInput
  }
  return commandInput.command
}

export const inferKubectlCommandName = (
  rawCommand: string
): KubectlCommandName | undefined => {
  const tokens = rawCommand
    .trim()
    .split(/\s+/)
    .filter((token) => {
      return token.length > 0
    })

  if (tokens.length === 0 || tokens[0] !== 'kubectl') {
    return undefined
  }

  if (tokens.length === 1) {
    return 'help'
  }

  const secondToken = tokens[1].toLowerCase()
  if (secondToken.startsWith('-')) {
    return 'help'
  }

  return normalizeKubectlCommandName(secondToken)
}

export const listCommandsFromSegments = (
  segments: LifecycleSegment[]
): KubectlCommandName[] => {
  const discovered = new Set<KubectlCommandName>()

  for (const segment of segments) {
    for (const commandInput of segment.commands) {
      const commandName = inferKubectlCommandName(getCommandText(commandInput))
      if (commandName !== undefined) {
        discovered.add(commandName)
      }
    }
  }

  return Array.from(discovered).sort((left, right) => {
    return left.localeCompare(right)
  })
}

export const filterSegmentsByCommand = (
  segments: LifecycleSegment[],
  commandName: KubectlCommandName
): LifecycleSegment[] => {
  const filtered: LifecycleSegment[] = []

  for (const segment of segments) {
    const matchingCommands = segment.commands.filter((commandInput) => {
      const candidate = inferKubectlCommandName(getCommandText(commandInput))
      return candidate === commandName
    })

    if (matchingCommands.length === 0) {
      continue
    }

    filtered.push({
      ...segment,
      commands: matchingCommands
    })
  }

  return filtered
}
