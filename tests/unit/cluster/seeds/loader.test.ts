import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { loadApiServerFromSeedPath } from '../../../../src/core/cluster/seeds/loader'

describe('seed loader', () => {
  const createdTempDirs: string[] = []

  afterEach(() => {
    for (const dir of createdTempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    createdTempDirs.length = 0
  })

  const createTempSeedDir = (): string => {
    const dir = mkdtempSync(join(tmpdir(), 'kube-mastery-seed-'))
    createdTempDirs.push(dir)
    return dir
  }

  it('should parse YAML docs separated with comment markers', () => {
    const seedDir = createTempSeedDir()
    writeFileSync(
      join(seedDir, 'seed.yaml'),
      `apiVersion: v1
kind: ConfigMap
metadata:
  name: first
  namespace: default
data:
  key: value
--- # second document
apiVersion: v1
kind: ConfigMap
metadata:
  name: second
  namespace: default
data:
  key: value
`
    )

    const result = loadApiServerFromSeedPath(seedDir)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.findResource('ConfigMap', 'first', 'default').ok).toBe(true)
    expect(result.value.findResource('ConfigMap', 'second', 'default').ok).toBe(true)
  })

  it('should skip unsupported resource kinds like Namespace', () => {
    const seedDir = createTempSeedDir()
    writeFileSync(
      join(seedDir, 'seed.yaml'),
      `apiVersion: v1
kind: Namespace
metadata:
  name: custom
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: from-seed
  namespace: default
data:
  key: value
`
    )

    const result = loadApiServerFromSeedPath(seedDir)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value.findResource('Namespace', 'custom').ok).toBe(false)
    expect(result.value.findResource('ConfigMap', 'from-seed', 'default').ok).toBe(
      true
    )
  })
})
