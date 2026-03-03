import { beforeEach, describe, expect, it } from 'vitest'
import { createClusterState } from '../../../../../src/core/cluster/ClusterState'
import { createEventBus } from '../../../../../src/core/cluster/events/EventBus'
import { createHostFileSystem } from '../../../../../src/core/filesystem/debianFileSystem'
import {
  createFileSystem,
  type FileSystem
} from '../../../../../src/core/filesystem/FileSystem'
import { parseCommand } from '../../../../../src/core/kubectl/commands/parser'
import { handleCreate } from '../../../../../src/core/kubectl/commands/handlers/applyCreate'

describe('applyCreate handler', () => {
  let fileSystem: FileSystem
  let eventBus: ReturnType<typeof createEventBus>
  let clusterState: ReturnType<typeof createClusterState>

  beforeEach(() => {
    eventBus = createEventBus()
    clusterState = createClusterState(eventBus)
    fileSystem = createFileSystem(createHostFileSystem())
  })

  it('should create deployment imperatively with --image', () => {
    const parsed = parseCommand(
      'kubectl create deployment my-dep --image=busybox'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('deployment.apps/my-dep created')
    const deployment = clusterState.findDeployment('my-dep', 'default')
    expect(deployment.ok).toBe(true)
  })

  it('should return explicit error when image is missing', () => {
    const parsed = parseCommand('kubectl create deployment my-dep')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('required flag(s) "image" not set')
    }
  })

  it('should return error when multiple images are used with command', () => {
    const parsed = parseCommand(
      'kubectl create deployment my-dep --image=busybox --image=nginx -- date'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'cannot specify multiple --image options and command'
      )
    }
  })

  it('should return explicit error when deployment name is missing', () => {
    const parsed = parseCommand('kubectl create deployment --image=busybox')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('requires a name')
    }
  })

  it('should create deployment in provided namespace', () => {
    const createNamespaceParsed = parseCommand(
      'kubectl create namespace staging'
    )
    expect(createNamespaceParsed.ok).toBe(true)
    if (!createNamespaceParsed.ok) {
      return
    }
    const createNamespaceResult = handleCreate(
      fileSystem,
      clusterState,
      createNamespaceParsed.value,
      eventBus
    )
    expect(createNamespaceResult.ok).toBe(true)

    const parsed = parseCommand(
      'kubectl create deployment my-dep --image=busybox -n staging'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(true)
    const deployment = clusterState.findDeployment('my-dep', 'staging')
    expect(deployment.ok).toBe(true)
  })

  it('should fail when deployment namespace does not exist', () => {
    const parsed = parseCommand(
      'kubectl create deployment my-dep --image=busybox -n staging'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Error from server (NotFound)')
      expect(result.error).toContain('namespaces "staging" not found')
    }
  })

  it('should keep create from file flow', () => {
    const yaml = `apiVersion: v1
kind: ConfigMap
metadata:
  name: test-config
data:
  key: value
`

    fileSystem.createFile('config.yaml')
    fileSystem.writeFile('config.yaml', yaml)

    const parsed = parseCommand('kubectl create -f config.yaml')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('created')
  })

  it('should create namespace imperatively with name', () => {
    const parsed = parseCommand('kubectl create namespace my-team')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('namespace/my-team created')
  })

  it('should create ingress from file', () => {
    const yaml = `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: demo-ingress
  namespace: default
spec:
  rules:
    - host: demo.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: frontend-service
                port:
                  number: 80
`

    fileSystem.createFile('ingress.yaml')
    fileSystem.writeFile('ingress.yaml', yaml)
    const parsed = parseCommand('kubectl create -f ingress.yaml')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleCreate(
      fileSystem,
      clusterState,
      parsed.value,
      eventBus
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain(
      'ingress.networking.k8s.io/demo-ingress created'
    )
    const ingress = clusterState.findIngress('demo-ingress', 'default')
    expect(ingress.ok).toBe(true)
  })

  it('should return AlreadyExists error when namespace already exists', () => {
    const first = parseCommand('kubectl create namespace my-team')
    expect(first.ok).toBe(true)
    if (!first.ok) {
      return
    }

    const firstResult = handleCreate(
      fileSystem,
      clusterState,
      first.value,
      eventBus
    )
    expect(firstResult.ok).toBe(true)

    const second = parseCommand('kubectl create namespace my-team')
    expect(second.ok).toBe(true)
    if (!second.ok) {
      return
    }

    const secondResult = handleCreate(
      fileSystem,
      clusterState,
      second.value,
      eventBus
    )
    expect(secondResult.ok).toBe(false)
    if (!secondResult.ok) {
      expect(secondResult.error).toContain('Error from server (AlreadyExists)')
      expect(secondResult.error).toContain(
        'namespaces "my-team" already exists'
      )
    }
  })
})
