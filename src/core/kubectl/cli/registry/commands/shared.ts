import { command } from '../../builder'
import type { KubectlCommandSpec } from '../../model'

export const createLeafCommand = (definition: {
  path: readonly string[]
  use: string
  short: string
  long?: string
  example?: string
  aliases?: readonly string[]
  handlerId?: string
  flags?: ReadonlyArray<{
    kind: 'bool' | 'string' | 'enum' | 'stringArray'
    name: string
    description: string
    short?: string
    defaultValue?: string
    enumValues?: readonly string[]
  }>
}): KubectlCommandSpec => {
  const builder = command({
    path: definition.path,
    use: definition.use,
    aliases: definition.aliases,
    description: {
      short: definition.short,
      long: definition.long,
      example: definition.example
    }
  })

  for (const flag of definition.flags ?? []) {
    const description = flag.description
    const short = flag.short
    const defaultValue = flag.defaultValue

    if (flag.kind === 'bool') {
      builder.flags.bool(flag.name, description, { short, defaultValue })
    }
    if (flag.kind === 'string') {
      builder.flags.string(flag.name, description, { short, defaultValue })
    }
    if (flag.kind === 'stringArray') {
      builder.flags.stringArray(flag.name, description, { short, defaultValue })
    }
    if (flag.kind === 'enum') {
      builder.flags.enum(flag.name, description, flag.enumValues ?? [], {
        short,
        defaultValue
      })
    }
  }

  if (definition.handlerId != null) {
    builder.handler(definition.handlerId)
  }

  return builder.build()
}
