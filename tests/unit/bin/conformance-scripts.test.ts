import { describe, expect, it } from 'vitest'
import {
  buildCommandSuite,
  buildExhaustiveSuite,
  listSupportedCommandSuites
} from '../../../bin/generate-conformance-scenario'
import {
  parseCliArgs,
  resolveSuitePath
} from '../../../bin/run-conformance'

describe('conformance scripts', () => {
  it('should build exhaustive suite with actions', () => {
    const suite = buildExhaustiveSuite()

    expect(suite.name).toBe('exhaustive-single-cluster-suite')
    expect(suite.actions.length).toBeGreaterThan(0)
  })

  it('should build command suite with filtered command actions', () => {
    const suite = buildCommandSuite('version')
    expect(suite).toBeDefined()
    if (suite == null) {
      return
    }

    const commandActions = suite.actions.filter((action) => {
      return action.type === 'command'
    })
    expect(commandActions.length).toBeGreaterThan(0)

    for (const action of commandActions) {
      if (action.type !== 'command') {
        continue
      }
      expect(action.command.startsWith('kubectl version')).toBe(true)
    }
  })

  it('should list command suites from catalog', () => {
    const suites = listSupportedCommandSuites()

    expect(suites).toContain('get')
    expect(suites).toContain('version')
    expect(suites).toContain('run')
    expect(suites).toContain('config')
  })

  it('should parse CLI options for command and list modes', () => {
    const listOptions = parseCliArgs(['--list'])
    expect(listOptions.list).toBe(true)
    expect(listOptions.quiet).toBe(false)

    const commandOptions = parseCliArgs(['--command=run'])
    expect(commandOptions.command).toBe('run')
    expect(commandOptions.list).toBe(false)

    const quietOptions = parseCliArgs(['--command=run', '--quiet'])
    expect(quietOptions.quiet).toBe(true)
  })

  it('should resolve suite path for command mode', () => {
    const resolvedPath = resolveSuitePath({
      command: 'get',
      list: false
    })

    expect(resolvedPath.endsWith('/bin/config/generated/by-command/get.json')).toBe(
      true
    )
  })
})
