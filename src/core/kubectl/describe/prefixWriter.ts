import { writeEscaped } from '../printers/terminalEscape'

/**
 * Indentation levels for describe output (refs/k8s/kubectl/pkg/describe/describe.go).
 */
export const LEVEL_0 = 0
export const LEVEL_1 = 1
export const LEVEL_2 = 2
export const LEVEL_3 = 3
export const LEVEL_4 = 4

const LEVEL_SPACE = '  '

const applyFormat = (format: string, args: readonly unknown[]): string => {
  let index = 0
  return format.replace(/%[%s]/g, (match) => {
    if (match === '%%') {
      return '%'
    }
    const value = args[index]
    index += 1
    if (value === undefined || value === null) {
      return ''
    }
    return String(value)
  })
}

export interface PrefixWriter {
  write: (level: number, format: string, ...args: unknown[]) => void
  writeLine: (...values: unknown[]) => void
  flush: () => void
  toString: () => string
}

const buildPrefix = (level: number): string => {
  return LEVEL_SPACE.repeat(level)
}

export const createStringPrefixWriter = (): PrefixWriter => {
  const chunks: string[] = []
  const out: PrefixWriter = {
    write: (level: number, format: string, ...args: unknown[]) => {
      const prefix = buildPrefix(level)
      const body = applyFormat(format, args)
      writeEscaped((chunk: string) => {
        chunks.push(chunk)
      }, `${prefix}${body}`)
    },
    writeLine: (...values: unknown[]) => {
      const line = `${values.join(' ')}\n`
      writeEscaped((chunk: string) => {
        chunks.push(chunk)
      }, line)
    },
    flush: () => {
      return
    },
    toString: () => {
      return chunks.join('')
    }
  }
  return out
}

export const createNestedPrefixWriter = (
  base: PrefixWriter,
  indent: number
): PrefixWriter => {
  return {
    write: (level: number, format: string, ...args: unknown[]) => {
      base.write(level + indent, format, ...args)
    },
    writeLine: (...values: unknown[]) => {
      base.write(indent, '%s', `${values.join(' ')}\n`)
    },
    flush: () => {
      base.flush()
    },
    toString: () => {
      return base.toString()
    }
  }
}
