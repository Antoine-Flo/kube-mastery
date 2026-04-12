import { KUBECTL_ROOT_COMMAND_SPEC } from '../kubectl/cli/registry/root'
import { getShellRegistryCommandNames } from '../shell/commands'
import type { KubectlCommandSpec, KubectlFlagSpec } from '../kubectl/cli/model'
import { KUBECTL_RESOURCES } from '../kubectl/commands/resourceCatalog'

type ShellFlags = Record<string, string[]>

const SHELL_FLAGS: ShellFlags = {
  cd: [],
  ls: ['-a', '--all', '-l'],
  pwd: [],
  sleep: [],
  mkdir: ['-p'],
  touch: [],
  cat: [],
  rm: ['-r'],
  clear: [],
  help: [],
  debug: [],
  env: [],
  nano: [],
  vi: [],
  vim: [],
  nslookup: [],
  curl: [],
  exit: []
}

const serializeFlag = (flag: KubectlFlagSpec): string => {
  const short = flag.short != null ? `(-${flag.short})` : ''
  const enumValues =
    flag.kind === 'enum' &&
    Array.isArray(flag.enumValues) &&
    flag.enumValues.length > 0
      ? `{${flag.enumValues.join(',')}}`
      : ''
  return `${flag.name}${short}:${flag.kind}${enumValues}`
}

const deduplicateFlags = (
  flags: readonly KubectlFlagSpec[]
): KubectlFlagSpec[] => {
  const byKey = new Map<string, KubectlFlagSpec>()
  for (const flag of flags) {
    const key = `${flag.name}|${flag.short ?? ''}`
    if (!byKey.has(key)) {
      byKey.set(key, flag)
    }
  }
  return [...byKey.values()]
}

const collectKubectlLines = (): string[] => {
  const lines: string[] = []

  const walk = (commandSpec: KubectlCommandSpec): void => {
    if (commandSpec.path.length > 0) {
      const allFlags = deduplicateFlags([
        ...KUBECTL_ROOT_COMMAND_SPEC.flags,
        ...commandSpec.flags
      ]).sort((left, right) => {
        return left.name.localeCompare(right.name)
      })
      const allFlagsText =
        allFlags.length > 0 ? allFlags.map(serializeFlag).join(', ') : 'none'
      lines.push(
        `kubectl ${commandSpec.path.join(' ')} | flags:${allFlagsText}`
      )
    }
    for (const child of commandSpec.subcommands) {
      walk(child)
    }
  }

  walk(KUBECTL_ROOT_COMMAND_SPEC)
  return lines.sort((left, right) => left.localeCompare(right))
}

const collectKubectlResourceAliasLines = (): string[] => {
  const lines: string[] = []
  const getCommandFlags = findCommandByPath(['get'])?.flags ?? []
  const describeCommandFlags = findCommandByPath(['describe'])?.flags ?? []
  const deleteCommandFlags = findCommandByPath(['delete'])?.flags ?? []

  const getFlags = deduplicateFlags([
    ...KUBECTL_ROOT_COMMAND_SPEC.flags,
    ...getCommandFlags
  ])
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(serializeFlag)
    .join(', ')
  const describeFlags = deduplicateFlags([
    ...KUBECTL_ROOT_COMMAND_SPEC.flags,
    ...describeCommandFlags
  ])
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(serializeFlag)
    .join(', ')
  const deleteFlags = deduplicateFlags([
    ...KUBECTL_ROOT_COMMAND_SPEC.flags,
    ...deleteCommandFlags
  ])
    .sort((left, right) => left.name.localeCompare(right.name))
    .map(serializeFlag)
    .join(', ')

  for (const aliases of Object.values(KUBECTL_RESOURCES)) {
    for (const alias of aliases) {
      lines.push(`kubectl get ${alias} | flags:${getFlags || 'none'}`)
      lines.push(
        `kubectl describe ${alias} <name> | flags:${describeFlags || 'none'}`
      )
      lines.push(
        `kubectl delete ${alias} <name> | flags:${deleteFlags || 'none'}`
      )
    }
  }
  return lines.sort((left, right) => left.localeCompare(right))
}

const findCommandByPath = (
  path: readonly string[]
): KubectlCommandSpec | undefined => {
  let current: KubectlCommandSpec = KUBECTL_ROOT_COMMAND_SPEC
  for (const segment of path) {
    const nextCommand = current.subcommands.find((subcommand) => {
      const commandSegment = subcommand.path[subcommand.path.length - 1]
      return commandSegment === segment
    })
    if (nextCommand == null) {
      return undefined
    }
    current = nextCommand
  }
  return current
}

const collectShellLines = (): string[] => {
  const commandNames = [...getShellRegistryCommandNames()]
  const lines = commandNames.map((commandName) => {
    const flags = SHELL_FLAGS[commandName] ?? []
    const flagsText = flags.length > 0 ? flags.join(', ') : 'none'
    return `bash ${commandName} | flags:${flagsText}`
  })
  return lines.sort((left, right) => left.localeCompare(right))
}

export const generateCommandIndexText = (): string => {
  const kubectlLines = collectKubectlLines()
  const kubectlResourceAliasLines = collectKubectlResourceAliasLines()
  const shellLines = collectShellLines()
  return [...kubectlLines, ...kubectlResourceAliasLines, ...shellLines].join(
    '\n'
  )
}
