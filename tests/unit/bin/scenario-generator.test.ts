import { describe, expect, it } from 'vitest'
import {
  buildSuiteFromScenario,
  buildSuiteFromSingleCommand
} from '../../../conformance/engine'

describe('conformance suite builder', () => {
  it('should build setup, cmds and cleanup actions in order', () => {
    const built = buildSuiteFromScenario({
      name: 'test-suite',
      clusterName: 'test-cluster',
      scenario: {
        setup: ['kubectl create deployment web --image=nginx:latest'],
        cmds: ['kubectl get pods'],
        cleanup: ['kubectl delete deployment web']
      }
    })

    expect(built.suite.actions).toHaveLength(3)
    expect(built.suite.actions[0]).toEqual({
      id: 'test-suite:setup:1',
      type: 'command',
      command: 'kubectl create deployment web --image=nginx:latest'
    })
    expect(built.suite.actions[1]).toEqual({
      id: 'test-suite:cmds:1',
      type: 'command',
      command: 'kubectl get pods'
    })
    expect(built.suite.actions[2]).toEqual({
      id: 'test-suite:cleanup:1',
      type: 'command',
      command: 'kubectl delete deployment web'
    })
    expect(built.cleanupActionIds).toEqual(['test-suite:cleanup:1'])
  })

  it('should support single command scenarios', () => {
    const built = buildSuiteFromSingleCommand(
      'kubectl get --raw /',
      'quick-check',
      'conformance'
    )
    expect(built.suite.actions[0]).toEqual({
      id: 'quick-check:cmds:1',
      type: 'command',
      command: 'kubectl get --raw /'
    })
    expect(built.cleanupActionIds).toHaveLength(0)
  })
})
