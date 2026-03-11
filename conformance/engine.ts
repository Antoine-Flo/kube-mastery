import { CONFIG } from '../src/config'
import {
  compareResults,
  runConformanceSuite
} from '../bin/lib/conformance-engine'
import type {
  ConformanceActionCompleteEvent,
  ConformanceProgressEvent,
  ConformanceProgressListener
} from '../bin/lib/conformance-engine'
import type { ConformanceAction } from './types'
import type { BuildSuiteOptions, BuiltScenarioSuite, ConformanceScenario } from './types'

const createCommandAction = (
  scenarioName: string,
  phase: 'setup' | 'cmds' | 'cleanup',
  command: string,
  index: number
): ConformanceAction => {
  return {
    id: `${scenarioName}:${phase}:${index + 1}`,
    type: 'command',
    command
  }
}

const toCommandActions = (
  scenarioName: string,
  phase: 'setup' | 'cmds' | 'cleanup',
  commands: string[] | undefined
): ConformanceAction[] => {
  if (commands == null || commands.length === 0) {
    return []
  }

  return commands.map((command, index) => {
    return createCommandAction(scenarioName, phase, command, index)
  })
}

export const buildSuiteFromScenario = (
  options: BuildSuiteOptions
): BuiltScenarioSuite => {
  const setupActions = toCommandActions(options.name, 'setup', options.scenario.setup)
  const commandActions = toCommandActions(options.name, 'cmds', options.scenario.cmds)
  const cleanupActions = toCommandActions(
    options.name,
    'cleanup',
    options.scenario.cleanup
  )

  const cleanupActionIds = cleanupActions.map((action) => {
    return action.id
  })

  return {
    suite: {
      name: options.name,
      clusterName: options.clusterName,
      actions: [...setupActions, ...commandActions, ...cleanupActions]
    },
    cleanupActionIds
  }
}

export const buildSuiteFromSingleCommand = (
  command: string,
  scenarioName = 'adhoc',
  clusterName = CONFIG.cluster.conformanceClusterName
): BuiltScenarioSuite => {
  const scenario: ConformanceScenario = { cmds: [command] }
  return buildSuiteFromScenario({
    name: scenarioName,
    clusterName,
    scenario
  })
}

export {
  compareResults,
  runConformanceSuite,
  type ConformanceActionCompleteEvent,
  type ConformanceProgressEvent,
  type ConformanceProgressListener
}
