import { describe, expect, it } from 'vitest'
import { parseDrillFile } from '../../../../src/content/drills/domain'

describe('parseDrillFile validation schema', () => {
  it('parses assertion-based validation', () => {
    const rawYaml = `
title: "Validation"
tasks:
  - task: "check"
    command: "kubectl get pods"
    explanation: "x"
    validation:
      assertions:
        - type: "clusterFieldEquals"
          kind: "Pod"
          namespace: "app"
          name: "web"
          path: "{.metadata.name}"
          value: "web"
          onFail: "missing"
`
    const parsed = parseDrillFile(rawYaml)
    expect(parsed).not.toBeNull()
    expect(parsed?.tasks[0].validation?.assertions).toHaveLength(1)
    expect(parsed?.tasks[0].validation?.assertions[0]).toMatchObject({
      type: 'clusterFieldEquals',
      kind: 'Pod',
      name: 'web'
    })
  })

  it('rejects unknown assertion types', () => {
    const rawYaml = `
title: "Validation"
tasks:
  - task: "check"
    command: "kubectl get pods"
    explanation: "x"
    validation:
      assertions:
        - type: "clusterUnknown"
          kind: "Pod"
          name: "web"
          onFail: "missing"
`
    expect(parseDrillFile(rawYaml)).toBeNull()
  })

  it('rejects malformed assertion payload', () => {
    const rawYaml = `
title: "Validation"
tasks:
  - task: "check"
    command: "kubectl get pods"
    explanation: "x"
    validation:
      assertions:
        - type: "clusterFieldEquals"
          kind: "Pod"
          namespace: "app"
          path: "{.metadata.name}"
          value: "web"
          onFail: "missing"
`
    expect(parseDrillFile(rawYaml)).toBeNull()
  })
})

