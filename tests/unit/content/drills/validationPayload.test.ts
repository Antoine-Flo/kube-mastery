import { describe, expect, it } from 'vitest'
import {
  buildDrillValidationPayload,
  parseDrillValidationPayload
} from '../../../../src/content/drills/validationPayload'
import type { DrillTask } from '../../../../src/content/drills/types'

describe('drill validation payload', () => {
  it('builds payload entries only for tasks with validation', () => {
    const tasks: DrillTask[] = [
      {
        task: 'a',
        command: 'kubectl get pods',
        explanation: 'a'
      },
      {
        task: 'b',
        command: 'kubectl get ns',
        explanation: 'b',
        validation: {
          assertions: [
            {
              type: 'clusterResourceExists',
              kind: 'Namespace',
              name: 'demo',
              onFail: 'x'
            }
          ]
        }
      }
    ]

    expect(buildDrillValidationPayload(tasks)).toEqual([
      {
        index: 1,
        assertions: [
          {
            type: 'clusterResourceExists',
            kind: 'Namespace',
            name: 'demo',
            onFail: 'x'
          }
        ]
      }
    ])
  })

  it('parses payload defensively', () => {
    const parsed = parseDrillValidationPayload([
      { index: 0, assertions: [] },
      { index: 'bad', assertions: [] },
      { index: 1, assertions: [{ type: 'x' }] }
    ])
    expect(parsed).toHaveLength(2)
    expect(parsed.map((item) => item.index)).toEqual([0, 1])
  })
})

