import { describe, expect, it } from 'vitest'
import { createCommandCatalogSegments } from '../../../bin/config/conformance/command-catalog'
import {
  filterSegmentsByCommand,
  inferKubectlCommandName,
  listCommandsFromSegments
} from '../../../bin/lib/command-segmentation'

describe('command segmentation', () => {
  it('should infer kubectl command names from command strings', () => {
    expect(inferKubectlCommandName('kubectl get pods')).toBe('get')
    expect(inferKubectlCommandName('kubectl cluster-info dump')).toBe('cluster-info')
    expect(inferKubectlCommandName('kubectl config get-contexts')).toBe('config')
    expect(inferKubectlCommandName('kubectl --help')).toBe('help')
    expect(inferKubectlCommandName('echo hello')).toBeUndefined()
  })

  it('should list supported command suites from catalog segments', () => {
    const commands = listCommandsFromSegments(createCommandCatalogSegments())

    expect(commands).toContain('get')
    expect(commands).toContain('run')
    expect(commands).toContain('config')
    expect(commands).toContain('help')
    expect(commands).toContain('api-resources')
  })

  it('should filter segments for a specific command', () => {
    const runSegments = filterSegmentsByCommand(
      createCommandCatalogSegments(),
      'run'
    )
    expect(runSegments.length).toBeGreaterThan(0)

    for (const segment of runSegments) {
      for (const commandInput of segment.commands) {
        const commandText =
          typeof commandInput === 'string' ? commandInput : commandInput.command
        expect(inferKubectlCommandName(commandText)).toBe('run')
      }
    }
  })
})
