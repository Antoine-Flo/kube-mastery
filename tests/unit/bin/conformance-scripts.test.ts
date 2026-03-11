import { describe, expect, it } from 'vitest'
import {
  buildSuiteFromScenario,
  buildSuiteFromSingleCommand
} from '../../../conformance/engine'
import {
  listScenarioKeys,
  parseCliArgs,
  resolveScenarioKeysToRun,
  resolveScenario
} from '../../../conformance/run'

describe('conformance scripts', () => {
  it('should build suite from scenario', () => {
    const built = buildSuiteFromScenario({
      name: 'example-suite',
      clusterName: 'test',
      scenario: {
        cmds: ['kubectl get pods']
      }
    })

    expect(built.suite.name).toBe('example-suite')
    expect(built.suite.actions.length).toBe(1)
  })

  it('should build suite for one command', () => {
    const built = buildSuiteFromSingleCommand('kubectl version')
    expect(built.suite.actions).toHaveLength(1)
    expect(built.suite.actions[0].type).toBe('command')
    if (built.suite.actions[0].type === 'command') {
      expect(built.suite.actions[0].command).toBe('kubectl version')
    }
  })

  it('should list available scenarios from catalog', () => {
    const scenarios = listScenarioKeys()
    expect(scenarios.length).toBeGreaterThan(0)
    for (const scenario of scenarios) {
      expect(scenario.length).toBeGreaterThan(0)
    }
  })

  it('should parse CLI options for scenario and cmd modes', () => {
    const listOptions = parseCliArgs(['--list'])
    expect(listOptions.list).toBe(true)
    expect(listOptions.quiet).toBe(false)

    const scenarioOptions = parseCliArgs(['--scenario=any-scenario-name'])
    expect(scenarioOptions.scenario).toBe('any-scenario-name')
    expect(scenarioOptions.list).toBe(false)

    const quietOptions = parseCliArgs(['--cmd=kubectl get pods', '--quiet'])
    expect(quietOptions.quiet).toBe(true)
    expect(quietOptions.cmd).toBe('kubectl get pods')
  })

  it('should resolve selected scenario', () => {
    const [firstScenarioKey] = listScenarioKeys()
    expect(firstScenarioKey).toBeDefined()
    const resolvedScenario = resolveScenario({
      scenario: firstScenarioKey,
      list: false,
      quiet: false
    })

    expect(resolvedScenario.name).toBe(firstScenarioKey)
    expect(resolvedScenario.scenario.cmds.length).toBeGreaterThan(0)
  })

  it('should resolve direct command as ad hoc scenario', () => {
    const resolvedScenario = resolveScenario({
      cmd: 'kubectl get pods',
      list: false,
      quiet: false
    })

    expect(resolvedScenario.name).toBe('adhoc')
    expect(resolvedScenario.scenario.cmds).toEqual(['kubectl get pods'])
  })

  it('should resolve all scenario keys when no scenario is provided', () => {
    const scenarioKeys = resolveScenarioKeysToRun({
      list: false,
      quiet: false
    })

    expect(scenarioKeys.length).toBeGreaterThan(1)
    expect(scenarioKeys).toEqual(listScenarioKeys())
  })
})
