import type { ExecutionResult } from '../../../../shared/result'
import { error } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

export interface CurlHandlerOptions {
  resolveNamespace?: () => string
  runCurl?: (target: string, namespace: string) => ExecutionResult
}

export const createCurlHandler = (
  options: CurlHandlerOptions = {}
): ShellCommandHandler => {
  return {
    execute: (args: string[]): ExecutionResult => {
      const target = args[0]
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
