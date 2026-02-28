export interface CommandExecutionResult {
  command: string
  exitCode: number
  stdout: string
  stderr: string
  combined: string
}

export interface ConformanceComparison {
  matched: boolean
  kindCompared: string
  runnerCompared: string
  diff: string
}

export interface ConformanceActionBase {
  id: string
  description?: string
}

export interface ApplyYamlAction extends ConformanceActionBase {
  type: 'applyYaml'
  targetPath: string
  waitForPods?: boolean
  namespace?: string
}

export interface DeleteYamlAction extends ConformanceActionBase {
  type: 'deleteYaml'
  targetPath: string
  ignoreNotFound?: boolean
}

export interface WaitPodsReadyAction extends ConformanceActionBase {
  type: 'waitPodsReady'
  namespace?: string
}

export interface CommandAction extends ConformanceActionBase {
  type: 'command'
  command: string
}

export type ConformanceAction =
  | ApplyYamlAction
  | DeleteYamlAction
  | WaitPodsReadyAction
  | CommandAction

export interface ConformanceSuite {
  name: string
  clusterName: string
  actions: ConformanceAction[]
}

export interface ActionExecutionRecord {
  suiteName: string
  actionId: string
  actionType: ConformanceAction['type']
  backend: 'kind' | 'runner'
  command: string
  exitCode: number
  stdout: string
  stderr: string
  normalized: string
}
