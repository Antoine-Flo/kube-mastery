import type { KubectlCommandSpec } from '../model'
import { KUBECTL_ROOT_COMMAND_SPEC } from '../registry/root'

export interface KubectlSupportMatrixEntry {
  path: string
  use: string
  hasHandler: boolean
  handlerId?: string
  flags: string[]
}

const walkCommands = (
  command: KubectlCommandSpec,
  visitor: (command: KubectlCommandSpec) => void
): void => {
  visitor(command)
  for (const child of command.subcommands) {
    walkCommands(child, visitor)
  }
}

export const getKubectlSupportMatrix = (): KubectlSupportMatrixEntry[] => {
  const entries: KubectlSupportMatrixEntry[] = []
  walkCommands(KUBECTL_ROOT_COMMAND_SPEC, (command) => {
    if (command.path.length === 0) {
      return
    }
    entries.push({
      path: command.path.join(' '),
      use: command.use,
      hasHandler: command.handlerId != null,
      handlerId: command.handlerId,
      flags: command.flags
        .filter((flag) => !flag.hidden)
        .map((flag) => flag.name)
        .sort((left, right) => left.localeCompare(right))
    })
  })
  return entries.sort((left, right) => left.path.localeCompare(right.path))
}
