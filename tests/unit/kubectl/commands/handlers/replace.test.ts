import { beforeEach, describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { createHostFileSystem } from '../../../../../src/core/filesystem/debianFileSystem'
import {
  createFileSystem,
  type FileSystem
} from '../../../../../src/core/filesystem/FileSystem'
import { handleReplace } from '../../../../../src/core/kubectl/commands/handlers/replace'
import { parseCommand } from '../../../../../src/core/kubectl/commands/parser'

describe('kubectl replace handler', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>
  let fileSystem: FileSystem

  beforeEach(() => {
    apiServer = createApiServerFacade()
    fileSystem = createFileSystem(createHostFileSystem())
  })

  it('should replace an existing pod from manifest', () => {
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'replace-me',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:1.28' }]
      })
    )

    fileSystem.createFile('replace-pod.yaml')
    fileSystem.writeFile(
      'replace-pod.yaml',
      `apiVersion: v1
kind: Pod
metadata:
  name: replace-me
  namespace: default
spec:
  containers:
    - name: main
      image: busybox:latest
`
    )

    const parsed = parseCommand('kubectl replace -f replace-pod.yaml')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleReplace(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('pod/replace-me replaced')
    const pod = apiServer.findResource('Pod', 'replace-me', 'default')
    expect(pod.ok).toBe(true)
    if (!pod.ok) {
      return
    }
    expect(pod.value.spec.containers[0].image).toBe('busybox:latest')
  })

  it('should force replace an existing pod', () => {
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'force-replace-me',
        namespace: 'default',
        labels: { app: 'old' },
        containers: [{ name: 'main', image: 'nginx:1.28' }]
      })
    )

    fileSystem.createFile('force-replace-pod.yaml')
    fileSystem.writeFile(
      'force-replace-pod.yaml',
      `apiVersion: v1
kind: Pod
metadata:
  name: force-replace-me
  namespace: default
  labels:
    app: new
spec:
  containers:
    - name: main
      image: busybox:latest
`
    )

    const parsed = parseCommand(
      'kubectl replace --force -f force-replace-pod.yaml'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleReplace(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('pod/force-replace-me replaced')
    const pod = apiServer.findResource('Pod', 'force-replace-me', 'default')
    expect(pod.ok).toBe(true)
    if (!pod.ok) {
      return
    }
    expect(pod.value.metadata.labels?.app).toBe('new')
    expect(pod.value.spec.containers[0].image).toBe('busybox:latest')
  })

  it('should not mutate cluster state on replace --dry-run=client', () => {
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'dry-run-replace',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:1.28' }]
      })
    )

    fileSystem.createFile('dry-run-replace.yaml')
    fileSystem.writeFile(
      'dry-run-replace.yaml',
      `apiVersion: v1
kind: Pod
metadata:
  name: dry-run-replace
  namespace: default
spec:
  containers:
    - name: main
      image: busybox:latest
`
    )

    const parsed = parseCommand(
      'kubectl replace -f dry-run-replace.yaml --dry-run=client'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleReplace(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(true)

    const pod = apiServer.findResource('Pod', 'dry-run-replace', 'default')
    expect(pod.ok).toBe(true)
    if (!pod.ok) {
      return
    }
    expect(pod.value.spec.containers[0].image).toBe('nginx:1.28')
  })

  it('should reset pod to ContainerCreating on force replace even when manifest has running status', () => {
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'force-replace-running',
        namespace: 'default',
        phase: 'Running',
        containers: [{ name: 'main', image: 'nginx:1.28' }]
      })
    )

    fileSystem.createFile('force-replace-running.yaml')
    fileSystem.writeFile(
      'force-replace-running.yaml',
      `apiVersion: v1
kind: Pod
metadata:
  name: force-replace-running
  namespace: default
spec:
  containers:
    - name: main
      image: not-a-real-image:9.9
status:
  phase: Running
  containerStatuses:
    - name: main
      ready: true
      state:
        waiting:
          reason: Running
`
    )

    const parsed = parseCommand(
      'kubectl replace --force -f force-replace-running.yaml'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleReplace(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    const pod = apiServer.findResource(
      'Pod',
      'force-replace-running',
      'default'
    )
    expect(pod.ok).toBe(true)
    if (!pod.ok) {
      return
    }
    expect(pod.value.status.phase).toBe('Pending')
    expect(pod.value.status.containerStatuses?.[0]?.stateDetails?.reason).toBe(
      'ContainerCreating'
    )
    expect(pod.value.status.containerStatuses?.[0]?.image).toBe(
      'not-a-real-image:9.9'
    )
    expect(pod.value.status.containerStatuses?.[0]?.imageID).toContain(
      'docker.io/library/not-a-real-image@sha256:'
    )
  })

  it('should return not found when replacing non existing resource', () => {
    fileSystem.createFile('missing-pod.yaml')
    fileSystem.writeFile(
      'missing-pod.yaml',
      `apiVersion: v1
kind: Pod
metadata:
  name: not-there
  namespace: default
spec:
  containers:
    - name: main
      image: nginx:latest
`
    )

    const parsed = parseCommand('kubectl replace -f missing-pod.yaml')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleReplace(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('pods "not-there" not found')
    }
  })

  it('should return kubectl-like path error when replace file is missing', () => {
    const parsed = parseCommand('kubectl replace -f missing-file.yaml')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleReplace(fileSystem, apiServer, parsed.value)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe(
        'error: the path "missing-file.yaml" does not exist'
      )
      expect(result.error).not.toContain('cat:')
    }
  })
})
