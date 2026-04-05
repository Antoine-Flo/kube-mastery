import type { ExecutionResult } from '../../../../shared/result'
import { error } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

export interface CurlHandlerOptions {
  resolveNamespace?: () => string
  runCurl?: (target: string, namespace: string) => ExecutionResult
}

const resolveCurlTarget = (args: string[]): string | undefined => {
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (token.startsWith('--url=')) {
      const value = token.slice('--url='.length)
      if (value.length > 0) {
        return value
      }
      continue
    }
    if (token === '--url') {
      const nextToken = args[index + 1]
      if (nextToken != null && nextToken.length > 0) {
        return nextToken
      }
      continue
    }
    if (token.startsWith('-')) {
      continue
    }
    return token
  }
  return undefined
}

export const createCurlHandler = (
  options: CurlHandlerOptions = {}
): ShellCommandHandler => {
  return {
    execute: (args: string[]): ExecutionResult => {
      const target = resolveCurlTarget(args)
      if (target == null || target.length === 0) {
        return error('curl: try "curl <url>"')
      }
      if (options.runCurl == null) {
        return error('network runtime is not available')
      }
      const namespace = options.resolveNamespace?.() ?? 'default'
      return options.runCurl(target, namespace)
    }
  }
}
