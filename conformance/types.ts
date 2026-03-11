import type {
  ConformanceAction,
  ConformanceSuite
} from '../bin/lib/conformance-types'

export interface ConformanceScenario {
  setup?: string[]
  cmds: string[]
  cleanup?: string[]
}

export type ConformanceScenarioCatalog = Record<string, ConformanceScenario>

export interface BuildSuiteOptions {
  name: string
  clusterName: string
  scenario: ConformanceScenario
}

export interface BuiltScenarioSuite {
  suite: ConformanceSuite
  cleanupActionIds: string[]
}

export type { ConformanceAction, ConformanceSuite }
