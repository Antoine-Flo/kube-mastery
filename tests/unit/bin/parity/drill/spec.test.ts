import { describe, expect, it } from 'vitest'
import { parseDrillParitySpec } from '../../../../../bin/parity/drill/spec'

describe('parseDrillParitySpec', () => {
  it('parses a valid drill parity spec', () => {
    const input = `
version: 1
drillId: sample-drill
manifests:
  - path: pv.yaml
    content: |
      apiVersion: v1
      kind: PersistentVolume
steps:
  - id: apply-pv
    run: kubectl apply -f pv.yaml
checks:
  cluster:
    - id: pv-check
      kind: pv
      name: data-pv
      path: '{.spec.storageClassName}'
      expected: manual
  filesystem:
    - id: pv-file
      path: pv.yaml
      contains: PersistentVolume
`
    const result = parseDrillParitySpec(input)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.drillId).toBe('sample-drill')
    expect(result.value.manifests).toHaveLength(1)
    expect(result.value.steps).toHaveLength(1)
    expect(result.value.checks.cluster).toHaveLength(1)
    expect(result.value.checks.filesystem).toHaveLength(1)
  })

  it('parses manifests that reference drill files via sourcePath', () => {
    const input = `
version: 1
drillId: sample-drill
manifests:
  - path: pv.yaml
    sourcePath: pv.yaml
steps:
  - run: kubectl apply -f pv.yaml
`
    const result = parseDrillParitySpec(input)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.manifests[0].sourcePath).toBe('pv.yaml')
    expect(result.value.manifests[0].content).toBeUndefined()
  })

  it('fails when required fields are missing', () => {
    const input = `
version: 1
manifests:
  - path: pv.yaml
    content: test
steps:
  - run: kubectl get pods
`
    const result = parseDrillParitySpec(input)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('requires `version` and `drillId`')
    }
  })

  it('fails for invalid filesystem checks', () => {
    const input = `
version: 1
drillId: sample-drill
manifests:
  - path: pv.yaml
    content: test
steps:
  - run: kubectl get pods
checks:
  filesystem:
    - id: file-check
      path: pv.yaml
`
    const result = parseDrillParitySpec(input)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Filesystem check needs either')
    }
  })

  it('fails when manifest has neither content nor sourcePath', () => {
    const input = `
version: 1
drillId: sample-drill
manifests:
  - path: pv.yaml
steps:
  - run: kubectl apply -f pv.yaml
`
    const result = parseDrillParitySpec(input)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('either `content` or `sourcePath`')
    }
  })
})
