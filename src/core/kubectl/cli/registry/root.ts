import { command } from '../builder'
import type { KubectlCommandSpec } from '../model'
import { KUBECTL_COMMAND_SPECS } from './commands'
import { KUBECTL_GLOBAL_FLAGS } from './globalFlags'

const rootBuilder = command({
  path: [],
  use: 'kubectl',
  description: {
    short: 'kubectl controls the Kubernetes cluster manager.',
    long: 'Find more information at: https://kubernetes.io/docs/reference/kubectl/'
  }
}).addCommand(...KUBECTL_COMMAND_SPECS)

for (const globalFlag of KUBECTL_GLOBAL_FLAGS) {
  if (globalFlag.kind === 'boolean') {
    rootBuilder.flags.bool(globalFlag.name, globalFlag.description, {
      short: globalFlag.short
    })
  }
  if (globalFlag.kind === 'string') {
    rootBuilder.flags.string(globalFlag.name, globalFlag.description, {
      short: globalFlag.short
    })
  }
  if (globalFlag.kind === 'string[]') {
    rootBuilder.flags.stringArray(globalFlag.name, globalFlag.description, {
      short: globalFlag.short
    })
  }
  if (globalFlag.kind === 'enum') {
    rootBuilder.flags.enum(
      globalFlag.name,
      globalFlag.description,
      globalFlag.enumValues ?? [],
      {
        short: globalFlag.short
      }
    )
  }
}

export const KUBECTL_ROOT_COMMAND_SPEC: KubectlCommandSpec = rootBuilder.build()
