import { describe, expect, it } from 'vitest'
import { generateLifecycleSuite } from '../../../bin/lib/scenario-generator'
import { getSeedPath } from '../../../bin/lib/cluster-manager'

describe('scenario generator', () => {
  it('should generate lifecycle actions with cleanup', () => {
    const suite = generateLifecycleSuite({
      name: 'test-suite',
      clusterName: 'test-cluster',
      segments: [
        {
          idPrefix: 'segment-a',
          seed: 'minimal',
          commands: ['kubectl get pods']
        }
      ]
    })

    expect(suite.actions).toHaveLength(3)
    expect(suite.actions[0]).toEqual({
      id: 'segment-a-apply',
      type: 'applyYaml',
      targetPath: getSeedPath('minimal'),
      waitForPods: undefined
    })
    expect(suite.actions[1]).toEqual({
      id: 'segment-a-cmd-1',
      type: 'command',
      command: 'kubectl get pods',
      compareMode: 'normalized'
    })
    expect(suite.actions[2]).toEqual({
      id: 'segment-a-cleanup',
      type: 'deleteYaml',
      targetPath: getSeedPath('minimal'),
      ignoreNotFound: true
    })
  })
})
