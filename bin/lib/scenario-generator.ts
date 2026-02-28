import { getSeedPath } from './cluster-manager'
import type { CommandAction, ConformanceAction, ConformanceSuite } from './conformance-types'

export interface LifecycleSegment {
  idPrefix: string
  seed: string
  waitForPods?: boolean
  commands: string[]
  cleanup?: boolean
}

export interface LifecycleSuiteTemplate {
  name: string
  clusterName: string
  segments: LifecycleSegment[]
}

const buildCommandAction = (
  segment: LifecycleSegment,
  command: string,
  commandIndex: number
): CommandAction => {
  return {
    id: `${segment.idPrefix}-cmd-${commandIndex + 1}`,
    type: 'command',
    command
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
    actions
  }
}
