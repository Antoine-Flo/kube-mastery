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
        commandBlocks: [{ lang: 'bash', code: 'kubectl get pods' }],
        explanation: 'a',
        solutionSegments: [
          { kind: 'code', lang: 'bash', code: 'kubectl get pods' },
          { kind: 'text', markdown: 'a' }
        ]
      },
      {
        task: 'b',
        commandBlocks: [{ lang: 'bash', code: 'kubectl get ns' }],
        explanation: 'b',
        solutionSegments: [
          { kind: 'code', lang: 'bash', code: 'kubectl get ns' },
          { kind: 'text', markdown: 'b' }
        ],
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
