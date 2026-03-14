import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../src/core/api/ApiServerFacade'
import {
  createPodBoundEvent,
  createPodUpdatedEvent
} from '../../../src/core/cluster/events/types'
import { createPod } from '../../../src/core/cluster/ressources/Pod'
import { createHostFileSystem } from '../../../src/core/filesystem/debianFileSystem'
import { createFileSystem } from '../../../src/core/filesystem/FileSystem'
import { createKubectlExecutor } from '../../../src/core/kubectl/commands/executor'
import { createLogger } from '../../../src/logger/Logger'

describe('kubernetes-like architecture chain', () => {
  it('propagates kubectl mutations through api facade and etcd revision', () => {
    const apiServer = createApiServerFacade()
    const fileSystem = createFileSystem(createHostFileSystem())
    const logger = createLogger()
    const executor = createKubectlExecutor(apiServer, fileSystem, logger)

    const initialVersion = apiServer.getResourceVersion()
    const createNamespaceResult = executor.execute('kubectl create namespace team-a')
    expect(createNamespaceResult.ok).toBe(true)

    const createDeploymentResult = executor.execute(
      'kubectl create deployment web --image=nginx:1.28 -n team-a'
    )
    expect(createDeploymentResult.ok).toBe(true)
    if (!createDeploymentResult.ok) {
      return
    }
    expect(createDeploymentResult.value).toContain('deployment.apps/web created')

    const deploymentResult = apiServer.findResource('Deployment', 'web', 'team-a')
    expect(deploymentResult.ok).toBe(true)

    const currentVersion = apiServer.getResourceVersion()
    expect(Number(currentVersion)).toBeGreaterThan(Number(initialVersion))

    const getResult = executor.execute('kubectl get deployments -n team-a -o json')
    expect(getResult.ok).toBe(true)
    if (!getResult.ok) {
      return
    }
    const parsed = JSON.parse(getResult.value) as {
      metadata?: { resourceVersion?: string }
    }
    expect(parsed.metadata?.resourceVersion).toBe(currentVersion)
  })

  it('propagates kubelet lifecycle events into kubectl describe output', () => {
    const apiServer = createApiServerFacade()
    const fileSystem = createFileSystem(createHostFileSystem())
    const logger = createLogger()
    const executor = createKubectlExecutor(apiServer, fileSystem, logger)

    const basePod = createPod({
      name: 'demo-pod',
      namespace: 'default',
      nodeName: 'worker-a',
      phase: 'Pending',
      containers: [{ name: 'app', image: 'nginx:latest' }]
    })
    apiServer.createResource('Pod', basePod)

    const runningPod = {
      ...basePod,
      status: {
        ...basePod.status,
        phase: 'Running' as const,
        containerStatuses: (basePod.status.containerStatuses ?? []).map(
          (status) => {
            return {
              ...status,
              ready: true,
              stateDetails: {
                state: 'Running' as const,
                startedAt: '2026-03-13T10:00:00.000Z'
              }
            }
          }
        )
      }
    }

    apiServer.eventBus.emit(
      createPodBoundEvent(
        basePod.metadata.name,
        basePod.metadata.namespace,
        'worker-a',
        basePod,
        basePod,
        'test'
      )
    )
    apiServer.eventBus.emit(
      createPodUpdatedEvent(
        runningPod.metadata.name,
        runningPod.metadata.namespace,
        runningPod,
        basePod,
        'test'
      )
    )

    const describeResult = executor.execute('kubectl describe pod demo-pod')
    expect(describeResult.ok).toBe(true)
    if (!describeResult.ok) {
      return
    }
    expect(describeResult.value).toContain('Scheduled')
    expect(describeResult.value).toContain('Successfully assigned default/demo-pod')
    expect(describeResult.value).toContain('Started')
    expect(describeResult.value).toContain('Container started')
  })
})
