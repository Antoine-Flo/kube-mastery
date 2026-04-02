import { resolveKubectlHelpFromSpec } from '../cli/runtime/help'

export const resolveKubectlHelp = (input: string): string | undefined => {
  return resolveKubectlHelpFromSpec(input)
}
