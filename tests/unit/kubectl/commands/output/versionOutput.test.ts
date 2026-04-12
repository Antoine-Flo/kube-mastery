import { describe, expect, it } from 'vitest'
import {
  buildSimulatedVersionPayload,
  formatVersionJson,
  formatVersionSimpleText,
  formatVersionYaml
} from '../../../../../src/core/kubectl/commands/output/versionOutput'

describe('versionOutput', () => {
  it('buildSimulatedVersionPayload respects clientOnly', () => {
    const clientOnly = buildSimulatedVersionPayload({ clientOnly: true })
    expect(clientOnly.serverVersion).toBeUndefined()
    const full = buildSimulatedVersionPayload({ clientOnly: false })
    expect(full.serverVersion).toBeDefined()
  })

  it('formatVersionSimpleText matches kubectl-style lines', () => {
    const text = formatVersionSimpleText(
      buildSimulatedVersionPayload({ clientOnly: true })
    )
    expect(text).toMatch(
      /^Client Version: v1\.35\.0\nKustomize Version: v5\.7\.1$/
    )
  })

  it('formatVersionJson is parseable', () => {
    const json = formatVersionJson(
      buildSimulatedVersionPayload({ clientOnly: true })
    )
    const parsed = JSON.parse(json) as { kustomizeVersion: string }
    expect(parsed.kustomizeVersion).toBe('v5.7.1')
  })

  it('formatVersionYaml contains keys', () => {
    const yaml = formatVersionYaml(
      buildSimulatedVersionPayload({ clientOnly: true })
    )
    expect(yaml).toContain('clientVersion:')
    expect(yaml).toContain('kustomizeVersion: v5.7.1')
  })
})
