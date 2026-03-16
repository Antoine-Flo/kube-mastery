import {
  applyYamlTarget,
  ensureCurrentContextNamespace,
  deleteYamlTarget,
  ensureCluster,
  resetConformanceClusterState
} from '../cluster-manager'
import { runShellCommandDetailed } from '../command-runner'
import type {
  ApplyYamlAction,
  CommandExecutionResult,
  DeleteYamlAction
} from '../conformance-types'
import type { Result } from '../types'
import { error, success } from '../types'

export interface KindExecutor {
  setup: () => Result<void, string>
  teardown: () => Result<void, string>
  executeCommand: (command: string) => CommandExecutionResult
  applyYaml: (action: ApplyYamlAction) => CommandExecutionResult
  deleteYaml: (action: DeleteYamlAction) => CommandExecutionResult
}

const toExecutionResult = (
  command: string,
  result: Result<string, string>
): CommandExecutionResult => {
  if (result.ok) {
    return {
      command,
      exitCode: 0,
      stdout: result.value,
      stderr: '',
      combined: result.value
    }
  }
  return {
    command,
    exitCode: 1,
    stdout: '',
    stderr: result.error,
    combined: result.error
  }
}

export const createKindExecutor = (clusterName: string): KindExecutor => {
  return {
    setup(): Result<void, string> {
      const setupResult = ensureCluster(clusterName)
      if (!setupResult.ok) {
        return error(setupResult.error)
      }
      const ensureNamespaceResult = ensureCurrentContextNamespace('default')
      if (!ensureNamespaceResult.ok) {
        return error(ensureNamespaceResult.error)
      }
      const resetResult = resetConformanceClusterState()
      if (!resetResult.ok) {
        return error(resetResult.error)
      }
      return success(undefined)
    },
    teardown(): Result<void, string> {
      const resetResult = resetConformanceClusterState()
      if (!resetResult.ok) {
        return error(resetResult.error)
      }
      return success(undefined)
    },
    executeCommand(command: string): CommandExecutionResult {
      return runShellCommandDetailed(command)
    },
    applyYaml(action: ApplyYamlAction): CommandExecutionResult {
      const command = `kubectl apply -f ${action.targetPath}`
      const applyResult = applyYamlTarget(action.targetPath)
      return toExecutionResult(command, applyResult)
    },
    deleteYaml(action: DeleteYamlAction): CommandExecutionResult {
      const command = `kubectl delete -f ${action.targetPath}`
      const deleteResult = deleteYamlTarget(
        action.targetPath,
        action.ignoreNotFound ?? true
      )
      return toExecutionResult(command, deleteResult)
    }
  }
}
