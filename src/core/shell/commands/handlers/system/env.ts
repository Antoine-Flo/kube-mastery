import type { Result } from '../../../../shared/result'
import { success } from '../../../../shared/result'
import type { ShellCommandHandler } from '../../core/ShellCommandHandler'

export interface EnvHandlerOptions {
  getEnvironmentVariables?: () => Result<string[]>
}

const DEFAULT_ENVIRONMENT_VARIABLES = [
  'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
  'HOME=/home/kube',
  'HOSTNAME=host-shell'
]

export const createEnvHandler = (
  options: EnvHandlerOptions = {}
): ShellCommandHandler => {
  return {
    execute: (): Result<string> => {
      if (options.getEnvironmentVariables == null) {
        return success(DEFAULT_ENVIRONMENT_VARIABLES.join('\n'))
      }
      const environmentResult = options.getEnvironmentVariables()
      if (!environmentResult.ok) {
        return environmentResult
      }
      return success(environmentResult.value.join('\n'))
    }
  }
}
