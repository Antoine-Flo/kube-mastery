export interface CommandExecutionResult {
  command: string
  exitCode: number
  stdout: string
  stderr: string
  combined: string
}

export interface ActionBase {
  id: string
  description?: string
}

export interface ApplyYamlAction extends ActionBase {
  type: 'applyYaml'
  targetPath: string
  namespace?: string
}

export interface DeleteYamlAction extends ActionBase {
  type: 'deleteYaml'
  targetPath: string
  ignoreNotFound?: boolean
}
