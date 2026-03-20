import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../src/core/api/ApiServerFacade'
import type { ApiServerFacade } from '../../../../src/core/api/ApiServerFacade'
import { createEventBus } from '../../../../src/core/cluster/events/EventBus'
import {
  createPodCreatedEvent,
  createPodDeletedEvent,
  createPodUpdatedEvent,
  createReplicaSetUpdatedEvent,
  type ReplicaSetUpdatedEvent
} from '../../../../src/core/cluster/events/types'
import { createPodLifecycleController } from '../../../../src/core/kubelet/controllers/PodLifecycleController'
import { ReplicaSetController } from '../../../../src/core/control-plane/controllers/ReplicaSetController'
import type { ControllerObservation } from '../../../../src/core/control-plane/controller-runtime/types'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'
import { createReplicaSet } from '../../../../src/core/cluster/ressources/ReplicaSet'
import type { AppEvent } from '../../../../src/core/events/AppEvent'

describe('controller observability', () => {
  it('emits enqueue, reconcile and skip observations in ReplicaSetController', async () => {
    const eventBus = createEventBus()
    const replicaSet = createReplicaSet({
      name: 'my-rs',
      namespace: 'default',
      replicas: 1,
      selector: { matchLabels: { app: 'my-rs' } },
      template: {
        metadata: { labels: { app: 'my-rs' } },
        spec: {
          containers: [{ name: 'nginx', image: 'nginx:latest' }]
        }
      }
    })
    const pod = createPod({
      name: 'my-rs-a',
      namespace: 'default',
      labels: { app: 'my-rs' },
      phase: 'Running',
      containers: [{ name: 'nginx', image: 'nginx:latest' }],
      ownerReferences: [
        {
          apiVersion: 'apps/v1',
          kind: 'ReplicaSet',
          name: 'my-rs',
          uid: 'default-my-rs',
          controller: true
        }
      ]
    })
    const mockState = {
      replicaSets: [replicaSet],
      pods: [pod]
    }
    const apiServer = {
      eventBus,
      getEventBus: () => eventBus,
      emitEvent: (event: AppEvent) => {
        eventBus.emit(event)
      },
      createResource: (kind: string, resource: unknown) => {
        if (kind === 'Pod') {
          const podResource = resource as typeof pod
          mockState.pods.push(podResource)
          eventBus.emit(createPodCreatedEvent(podResource, 'api-server'))
          return { ok: true, value: podResource }
        }
        return { ok: false, error: 'unsupported kind' }
      },
      deleteResource: (kind: string, name: string, namespace?: string) => {
        if (kind === 'Pod') {
          const index = mockState.pods.findIndex((entry) => {
            return (
              entry.metadata.name === name &&
              entry.metadata.namespace === (namespace ?? 'default')
            )
          })
          if (index < 0) {
            return { ok: false, error: 'not found' }
          }
          const [deletedPod] = mockState.pods.splice(index, 1)
          eventBus.emit(
            createPodDeletedEvent(
              name,
              namespace ?? 'default',
              deletedPod,
              'api-server'
            )
          )
          return { ok: true, value: deletedPod }
        }
        return { ok: false, error: 'unsupported kind' }
      },
      updateResource: (
        kind: string,
        name: string,
        resource: unknown,
        namespace?: string
      ) => {
        if (kind === 'ReplicaSet') {
          const replicaSetResource = resource as typeof replicaSet
          const index = mockState.replicaSets.findIndex((entry) => {
            return (
              entry.metadata.name === name &&
              entry.metadata.namespace === (namespace ?? 'default')
            )
          })
          if (index < 0) {
            return { ok: false, error: 'not found' }
          }
          const previous = mockState.replicaSets[index]
          mockState.replicaSets[index] = replicaSetResource
          eventBus.emit(
            createReplicaSetUpdatedEvent(
              name,
              namespace ?? 'default',
              replicaSetResource,
              previous,
              'api-server'
            )
          )
          return { ok: true, value: replicaSetResource }
        }
        return { ok: false, error: 'unsupported kind' }
      },
      listResources: (kind: string, namespace?: string) => {
        if (kind === 'ReplicaSet') {
          if (namespace == null) {
            return mockState.replicaSets
          }
          return mockState.replicaSets.filter((entry) => {
            return entry.metadata.namespace === namespace
          })
        }
        if (kind === 'Pod') {
          if (namespace == null) {
            return mockState.pods
          }
          return mockState.pods.filter((entry) => {
            return entry.metadata.namespace === namespace
          })
        }
        return []
      },
      findResource: (kind: string, name: string, namespace?: string) => {
        if (kind === 'ReplicaSet') {
          const current = mockState.replicaSets.find((entry) => {
            return (
              entry.metadata.name === name &&
              entry.metadata.namespace === (namespace ?? 'default')
            )
          })
          if (current == null) {
            return { ok: false }
          }
          return { ok: true, value: current }
        }
        if (kind === 'Pod') {
          const current = mockState.pods.find((entry) => {
            return (
              entry.metadata.name === name &&
              entry.metadata.namespace === (namespace ?? 'default')
            )
          })
          if (current == null) {
            return { ok: false }
          }
          return { ok: true, value: current }
        }
        return { ok: false }
      },
      clusterState: {
        getReplicaSets: (namespace?: string) => {
          if (namespace == null) {
            return mockState.replicaSets
          }
          return mockState.replicaSets.filter((rs) => {
            return rs.metadata.namespace === namespace
          })
        },
        findReplicaSet: (name: string, namespace: string) => {
          const current = mockState.replicaSets.find((rs) => {
            return (
              rs.metadata.name === name && rs.metadata.namespace === namespace
            )
          })
          if (current == null) {
            return { ok: false }
          }
          return { ok: true, value: current }
        },
        getPods: (namespace?: string) => {
          if (namespace == null) {
            return mockState.pods
          }
          return mockState.pods.filter((entry) => {
            return entry.metadata.namespace === namespace
          })
        },
        findPod: () => ({ ok: false }),
        getDeployments: () => [],
        findDeployment: () => ({ ok: false }),
        getDaemonSets: () => [],
        findDaemonSet: () => ({ ok: false }),
        getNodes: () => [],
        getPersistentVolumes: () => [],
        findPersistentVolume: () => ({ ok: false }),
        getPersistentVolumeClaims: () => [],
        findPersistentVolumeClaim: () => ({ ok: false })
      }
    } as unknown as ApiServerFacade

    const observations: ControllerObservation[] = []
    eventBus.subscribe('ReplicaSetUpdated', (event: ReplicaSetUpdatedEvent) => {
      mockState.replicaSets = [event.payload.replicaSet]
    })
    const controller = new ReplicaSetController(apiServer, {
      observer: (observation) => {
        observations.push(observation)
      }
    })
    controller.start()

    eventBus.emit(
      createPodUpdatedEvent(
        pod.metadata.name,
        pod.metadata.namespace,
        pod,
        pod,
        'test'
      )
    )
    await new Promise((resolve) => setTimeout(resolve, 25))
    controller.stop()

    expect(
      observations.some((entry) => {
        return (
          entry.controller === 'ReplicaSetController' &&
          entry.action === 'enqueue' &&
          entry.eventType === 'PodUpdated'
        )
      })
    ).toBe(true)
    expect(
      observations.some((entry) => {
        return (
          entry.controller === 'ReplicaSetController' &&
          entry.action === 'reconcile' &&
          entry.key === 'default/my-rs'
        )
      })
    ).toBe(true)
    expect(
      observations.some((entry) => {
        return (
          entry.controller === 'ReplicaSetController' &&
          entry.action === 'skip' &&
          entry.reason === 'NoStatusChange'
        )
      })
    ).toBe(true)
  })

  it('emits VolumeNotReady skip reason in PodLifecycleController', () => {
    const apiServer = createApiServerFacade()
    const pod = createPod({
      name: 'pending-pod',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'worker-1',
      containers: [{ name: 'nginx', image: 'nginx:latest' }]
    })
    apiServer.createResource('Pod', pod)

    const observations: ControllerObservation[] = []
    const controller = createPodLifecycleController(apiServer, {
      observer: (observation) => {
        observations.push(observation)
      },
      volumeReadinessProbe: () => ({ ready: false, reason: 'PVCPending' })
    })

    controller.reconcile('default/pending-pod')

    expect(
      observations.some((entry) => {
        return (
          entry.controller === 'PodLifecycleController' &&
          entry.action === 'skip' &&
          entry.reason === 'VolumeNotReady'
        )
      })
    ).toBe(true)
  })
})
