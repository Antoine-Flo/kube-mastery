import type { ExecutionResult } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

const parseSleepSeconds = (
  rawValue: string
): ExecutionResult & { seconds?: number } => {
  const normalized = rawValue.trim()
  if (normalized.length === 0) {
    return error('sleep: missing operand')
  }
  if (normalized === 'infinity' || normalized === 'inf') {
    return {
      ok: true,
      value: '',
      seconds: Number.POSITIVE_INFINITY
    }
  }
  const seconds = Number(normalized)
  if (!Number.isFinite(seconds) || Number.isNaN(seconds)) {
    return error(`sleep: invalid time interval '${rawValue}'`)
  }
  if (seconds < 0) {
    return error(`sleep: invalid time interval '${rawValue}'`)
  }
  return {
    ok: true,
    value: '',
    seconds
  }
}

export const createSleepHandler = (): ShellCommandHandler => {
  return {
    execute: (args): ExecutionResult => {
      if (args.length === 0) {
        return error('sleep: missing operand')
      }
      if (args.length > 1) {
        return error('sleep: too many arguments')
      }
      const parsed = parseSleepSeconds(args[0])
      if (!parsed.ok) {
        return parsed
      }
      return success('')
    }
  }
}
