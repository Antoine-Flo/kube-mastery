import type { ParsedCommand } from '../types'

export const getFilenameFromFlags = (
  parsed: ParsedCommand
): string | undefined => {
  const filename = parsed.flags.f || parsed.flags.filename
  if (typeof filename !== 'string') {
    return undefined
  }
  return filename
}
