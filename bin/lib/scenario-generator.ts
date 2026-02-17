import { getSeedPath } from './cluster-manager'
import type {
  CommandAction,
  CommandExpectation,
  ConformanceAction,
  ConformanceSuite
} from './conformance-types'

export interface LifecycleCommandConfig {
  command: string
  compareMode?: CommandAction['compareMode']
  expectKind?: CommandExpectation
  expectRunner?: CommandExpectation
}

export interface LifecycleSegment {
  idPrefix: string
  seed: string
  waitForPods?: boolean
  commands: Array<string | LifecycleCommandConfig>
  cleanup?: boolean
}

export interface LifecycleSuiteTemplate {
  name: string
  clusterName: string
  segments: LifecycleSegment[]
  stopOnMismatch?: boolean
}

const buildCommandAction = (
  segment: LifecycleSegment,
  commandInput: string | LifecycleCommandConfig,
  commandIndex: number
): CommandAction => {
  const commandConfig: LifecycleCommandConfig =
    typeof commandInput === 'string'
      ? { command: commandInput }
      : commandInput
  return {
    id: `${segment.idPrefix}-cmd-${commandIndex + 1}`,
    type: 'command',
    command: commandConfig.command,
    compareMode: commandConfig.compareMode ?? 'normalized',
    ...(commandConfig.expectKind !== undefined
      ? { expectKind: commandConfig.expectKind }
      : {}),
    ...(commandConfig.expectRunner !== undefined
      ? { expectRunner: commandConfig.expectRunner }
      : {})
  }
}

export const generateLifecycleSuite = (
  template: LifecycleSuiteTemplate
): ConformanceSuite => {
  const actions: ConformanceAction[] = []

  for (const segment of template.segments) {
    const seedPath = getSeedPath(segment.seed)
    actions.push({
      id: `${segment.idPrefix}-apply`,
      type: 'applyYaml',
      targetPath: seedPath,
      waitForPods: segment.waitForPods
    })
    let commandIndex = 0
    for (const command of segment.commands) {
      actions.push(buildCommandAction(segment, command, commandIndex))
      commandIndex++
    }
    if (segment.cleanup ?? true) {
      actions.push({
        id: `${segment.idPrefix}-cleanup`,
        type: 'deleteYaml',
        targetPath: seedPath,
        ignoreNotFound: true
      })
    }
  }

  return {
    name: template.name,
    clusterName: template.clusterName,
    actions,
    stopOnMismatch: template.stopOnMismatch ?? true
  }
}
