import { beforeEach, describe, expect, it } from 'vitest'
import { createClusterState } from '../../../../../src/core/cluster/ClusterState'
import { createEventBus } from '../../../../../src/core/cluster/events/EventBus'
import { createConfigMap } from '../../../../../src/core/cluster/ressources/ConfigMap'
import { createSecret } from '../../../../../src/core/cluster/ressources/Secret'
import { createHostFileSystem } from '../../../../../src/core/filesystem/debianFileSystem'
import {
  createFileSystem,
  type FileSystem
} from '../../../../../src/core/filesystem/FileSystem'
import { parseCommand } from '../../../../../src/core/kubectl/commands/parser'
import { handleDiff } from '../../../../../src/core/kubectl/commands/handlers/diff'

describe('kubectl diff handler', () => {
  let fileSystem: FileSystem
  let eventBus: ReturnType<typeof createEventBus>
  let clusterState: ReturnType<typeof createClusterState>

  beforeEach(() => {
    eventBus = createEventBus()
    clusterState = createClusterState(eventBus)
    fileSystem = createFileSystem(createHostFileSystem())
  })

  const executeDiff = (command: string) => {
    const parsed = parseCommand(command)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      throw new Error(parsed.error)
    }
    return handleDiff(fileSystem, clusterState, parsed.value)
  }

  it('should return diff when resource does not exist in live state', () => {
    const yaml = `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
data:
  mode: blue
`
    fileSystem.createFile('configmap.yaml')
    fileSystem.writeFile('configmap.yaml', yaml)

    const result = executeDiff('kubectl diff -f configmap.yaml')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('diff -u -N /tmp/LIVE-')
    expect(result.value).toContain('/tmp/MERGED-')
    expect(result.value).toContain('+apiVersion: v1')
  })

  it('should return empty output when live and merged are identical', () => {
    clusterState.addConfigMap(
      createConfigMap({
        name: 'app-config',
        namespace: 'default',
        data: { mode: 'blue' }
      })
    )

    const yaml = `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
data:
  mode: blue
`
    fileSystem.createFile('same-configmap.yaml')
    fileSystem.writeFile('same-configmap.yaml', yaml)

    const result = executeDiff('kubectl diff -f same-configmap.yaml')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toBe('')
  })

  it('should return unified diff when resource changes', () => {
    clusterState.addConfigMap(
      createConfigMap({
        name: 'app-config',
        namespace: 'default',
        data: { mode: 'blue' }
      })
    )

    const yaml = `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: default
data:
  mode: green
`
    fileSystem.createFile('changed-configmap.yaml')
    fileSystem.writeFile('changed-configmap.yaml', yaml)

    const result = executeDiff('kubectl diff -f changed-configmap.yaml')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('-  mode: blue')
    expect(result.value).toContain('+  mode: green')
  })

  it('should mask secret values in diff output', () => {
    clusterState.addSecret(
      createSecret({
        name: 'app-secret',
        namespace: 'default',
        secretType: { type: 'Opaque' },
        data: {
          password: 'old-value'
        }
      })
    )

    const yaml = `apiVersion: v1
kind: Secret
metadata:
  name: app-secret
  namespace: default
type: Opaque
data:
  password: new-value
`
    fileSystem.createFile('secret.yaml')
    fileSystem.writeFile('secret.yaml', yaml)

    const result = executeDiff('kubectl diff -f secret.yaml')

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('*** (before)')
    expect(result.value).toContain('*** (after)')
    expect(result.value).not.toContain('old-value')
    expect(result.value).not.toContain('new-value')
  })
})
