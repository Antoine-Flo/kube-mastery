import type { ExecutionResult } from '../../../../shared/result'
import { error } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

export interface NslookupHandlerOptions {
  resolveNamespace?: () => string
  runDnsLookup?: (query: string, namespace: string) => ExecutionResult
}

export const createNslookupHandler = (
  options: NslookupHandlerOptions = {}
): ShellCommandHandler => {
  return {
    execute: (args: string[]): ExecutionResult => {
      const query = args[0]
      if (query == null || query.length === 0) {
        return error('** server can not find : NXDOMAIN')
      }
      if (options.runDnsLookup == null) {
        return error('network runtime is not available')
      }
      const namespace = options.resolveNamespace?.() ?? 'default'
      return options.runDnsLookup(query, namespace)
    }
  }
}
