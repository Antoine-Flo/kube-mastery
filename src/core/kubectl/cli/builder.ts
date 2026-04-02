import type {
  KubectlArgSpec,
  KubectlCommandDescription,
  KubectlCommandSpec,
  KubectlFlagSpec
} from './model'

type MutableCommandSpec = {
  path: string[]
  use: string
  aliases: string[]
  disableFlagsInUseLine: boolean
  description: KubectlCommandDescription
  flags: KubectlFlagSpec[]
  args: KubectlArgSpec[]
  subcommands: KubectlCommandSpec[]
  handlerId?: string
}

export type CommandBuilder = {
  addCommand: (...subcommands: KubectlCommandSpec[]) => CommandBuilder
  flags: {
    bool: (
      name: string,
      description: string,
      options?: {
        short?: string
        required?: boolean
        hidden?: boolean
        defaultValue?: string
      }
    ) => CommandBuilder
    string: (
      name: string,
      description: string,
      options?: {
        short?: string
        required?: boolean
        hidden?: boolean
        defaultValue?: string
      }
    ) => CommandBuilder
    enum: (
      name: string,
      description: string,
      enumValues: readonly string[],
      options?: {
        short?: string
        required?: boolean
        hidden?: boolean
        defaultValue?: string
      }
    ) => CommandBuilder
    stringArray: (
      name: string,
      description: string,
      options?: {
        short?: string
        required?: boolean
        hidden?: boolean
        defaultValue?: string
      }
    ) => CommandBuilder
  }
  args: (...args: KubectlArgSpec[]) => CommandBuilder
  handler: (handlerId: string) => CommandBuilder
  build: () => KubectlCommandSpec
}

const createMutableSpec = (
  path: readonly string[],
  use: string,
  description: KubectlCommandDescription,
  options?: {
    aliases?: readonly string[]
    disableFlagsInUseLine?: boolean
  }
): MutableCommandSpec => {
  return {
    path: [...path],
    use,
    aliases: options?.aliases ? [...options.aliases] : [],
    disableFlagsInUseLine: options?.disableFlagsInUseLine ?? true,
    description,
    flags: [],
    args: [],
    subcommands: []
  }
}

const appendFlag = (
  mutableSpec: MutableCommandSpec,
  flag: KubectlFlagSpec
): void => {
  mutableSpec.flags.push(flag)
}

const buildCommandSpec = (
  mutableSpec: MutableCommandSpec
): KubectlCommandSpec => {
  return {
    path: Object.freeze([...mutableSpec.path]),
    use: mutableSpec.use,
    aliases: Object.freeze([...mutableSpec.aliases]),
    disableFlagsInUseLine: mutableSpec.disableFlagsInUseLine,
    description: mutableSpec.description,
    flags: Object.freeze([...mutableSpec.flags]),
    args: Object.freeze([...mutableSpec.args]),
    subcommands: Object.freeze([...mutableSpec.subcommands]),
    handlerId: mutableSpec.handlerId
  }
}

export const command = (definition: {
  path: readonly string[]
  use: string
  description: KubectlCommandDescription
  aliases?: readonly string[]
  disableFlagsInUseLine?: boolean
}): CommandBuilder => {
  const mutableSpec = createMutableSpec(
    definition.path,
    definition.use,
    definition.description,
    {
      aliases: definition.aliases,
      disableFlagsInUseLine: definition.disableFlagsInUseLine
    }
  )

  const builder: CommandBuilder = {
    addCommand: (...subcommands) => {
      mutableSpec.subcommands.push(...subcommands)
      return builder
    },
    flags: {
      bool: (name, description, options) => {
        appendFlag(mutableSpec, {
          name,
          short: options?.short,
          kind: 'boolean',
          description,
          defaultValue: options?.defaultValue,
          required: options?.required,
          hidden: options?.hidden
        })
        return builder
      },
      string: (name, description, options) => {
        appendFlag(mutableSpec, {
          name,
          short: options?.short,
          kind: 'string',
          description,
          defaultValue: options?.defaultValue,
          required: options?.required,
          hidden: options?.hidden
        })
        return builder
      },
      enum: (name, description, enumValues, options) => {
        appendFlag(mutableSpec, {
          name,
          short: options?.short,
          kind: 'enum',
          description,
          defaultValue: options?.defaultValue,
          enumValues,
          required: options?.required,
          hidden: options?.hidden
        })
        return builder
      },
      stringArray: (name, description, options) => {
        appendFlag(mutableSpec, {
          name,
          short: options?.short,
          kind: 'string[]',
          description,
          defaultValue: options?.defaultValue,
          required: options?.required,
          hidden: options?.hidden
        })
        return builder
      }
    },
    args: (...args) => {
      mutableSpec.args.push(...args)
      return builder
    },
    handler: (handlerId) => {
      mutableSpec.handlerId = handlerId
      return builder
    },
    build: () => {
      return buildCommandSpec(mutableSpec)
    }
  }

  return builder
}
