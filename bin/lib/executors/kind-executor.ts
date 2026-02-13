import {
  applyYamlTarget,
  deleteCluster,
  deleteYamlTarget,
  ensureCluster,
  waitForPodsReady
} from '../cluster-manager'
import { runShellCommandDetailed } from '../command-runner'
import type {
  ApplyYamlAction,
  CommandExecutionResult,
  DeleteYamlAction,
  WaitPodsReadyAction
} from '../conformance-types'
import type { Result } from '../types'
import { error, success } from '../types'

export interface KindExecutor {
  setup: () => Result<void, string>
  teardown: () => Result<void, string>
  executeCommand: (command: string) => CommandExecutionResult
  applyYaml: (action: ApplyYamlAction) => CommandExecutionResult
  deleteYaml: (action: DeleteYamlAction) => CommandExecutionResult
  waitPodsReady: (action: WaitPodsReadyAction) => CommandExecutionResult
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
      return success(undefined)
    },
    teardown(): Result<void, string> {
      const deleteResult = deleteCluster(clusterName)
      if (!deleteResult.ok) {
        return error(deleteResult.error)
      }
      return success(undefined)
    },
    executeCommand(command: string): CommandExecutionResult {
      return runShellCommandDetailed(command)
    },
    applyYaml(action: ApplyYamlAction): CommandExecutionResult {
      const command = `kubectl apply -f ${action.targetPath}`
      const applyResult = applyYamlTarget(action.targetPath)
      if (!applyResult.ok) {
        return toExecutionResult(command, applyResult)
      }
      if (action.waitForPods) {
        const waitResult = waitForPodsReady(action.namespace)
        if (!waitResult.ok) {
          return {
            command,
            exitCode: 1,
            stdout: applyResult.value,
            stderr: waitResult.error,
            combined:
              applyResult.value.length > 0
                ? `${applyResult.value}\n${waitResult.error}`
                : waitResult.error
          }
        }
      }
      return toExecutionResult(command, applyResult)
    },
    deleteYaml(action: DeleteYamlAction): CommandExecutionResult {
      const command = `kubectl delete -f ${action.targetPath}`
      const deleteResult = deleteYamlTarget(
        action.targetPath,
        action.ignoreNotFound ?? true
      )
      return toExecutionResult(command, deleteResult)
    },
    waitPodsReady(action: WaitPodsReadyAction): CommandExecutionResult {
      const command = action.namespace
        ? `kubectl wait --for=condition=Ready pod --all -n ${action.namespace}`
        : 'kubectl wait --for=condition=Ready pod --all --all-namespaces'
      const waitResult = waitForPodsReady(action.namespace)
      if (!waitResult.ok) {
        return {
          command,
          exitCode: 1,
          stdout: '',
          stderr: waitResult.error,
          combined: waitResult.error
        }
      }
      return {
        command,
        exitCode: 0,
        stdout: 'pods ready',
        stderr: '',
        combined: 'pods ready'
      }
    }
  }
}
