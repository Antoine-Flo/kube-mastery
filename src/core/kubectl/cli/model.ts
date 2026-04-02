import type { Result } from '../../shared/result'
import type { ParsedCommand } from '../commands/types'

export type KubectlFlagValueKind = 'boolean' | 'string' | 'enum' | 'string[]'

export interface KubectlFlagSpec {
  name: string
  short?: string
  kind: KubectlFlagValueKind
  description: string
  defaultValue?: string
  enumValues?: readonly string[]
  required?: boolean
  hidden?: boolean
}

export interface KubectlArgSpec {
  name: string
  required: boolean
  variadic?: boolean
  description?: string
}

export type KubectlCommandStage = 'complete' | 'validate' | 'run'

export interface KubectlCommandRuntimeContext {
  rawInput: string
  tokens: string[]
  parsed: ParsedCommand
}

export type KubectlCommandHook = (
  context: KubectlCommandRuntimeContext
) => Result<void>

export interface KubectlCommandDescription {
  short: string
  long?: string
  example?: string
  officialDescription?: {
    use?: string
    short?: string
    long?: string
    example?: string
    sourcePath?: string
  }
  simOverride?: {
    short?: string
    long?: string
    example?: string
  }
}

export interface KubectlCommandSpec {
  path: readonly string[]
  use: string
  aliases?: readonly string[]
  disableFlagsInUseLine?: boolean
  description: KubectlCommandDescription
  flags: readonly KubectlFlagSpec[]
  args?: readonly KubectlArgSpec[]
  subcommands: readonly KubectlCommandSpec[]
  handlerId?: string
  hooks?: Partial<Record<KubectlCommandStage, KubectlCommandHook>>
}

export interface KubectlResolvedCommand {
  command: KubectlCommandSpec
  consumedTokens: number
}

export interface KubectlCompletionSuggestion {
  text: string
  suffix: string
}
