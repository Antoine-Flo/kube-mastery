import { describe, expect, it } from 'vitest'
import { createEventBus } from '../../../../src/core/cluster/events/EventBus'
import { createPodUpdatedEvent } from '../../../../src/core/cluster/events/types'
import { PodLifecycleController } from '../../../../src/core/cluster/controllers/PodLifecycleController'
import { ReplicaSetController } from '../../../../src/core/cluster/controllers/ReplicaSetController'
import type {
  ControllerObservation,
  ControllerState
} from '../../../../src/core/cluster/controllers/types'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'
import { createReplicaSet } from '../../../../src/core/cluster/ressources/ReplicaSet'

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
    const getState = (): ControllerState => {
      return {
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
            return rs.metadata.name === name && rs.metadata.namespace === namespace
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
    }

    const observations: ControllerObservation[] = []
    eventBus.subscribe('ReplicaSetUpdated', (event) => {
      mockState.replicaSets = [event.payload.replicaSet]
    })
    const controller = new ReplicaSetController(eventBus, getState, {
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
    const eventBus = createEventBus()
    const pod = createPod({
      name: 'pending-pod',
      namespace: 'default',
      phase: 'Pending',
      nodeName: 'worker-1',
      containers: [{ name: 'nginx', image: 'nginx:latest' }]
    })
    const mockState = {
      pods: [pod]
    }
    const getState = (): ControllerState => {
      return {
        getPods: () => mockState.pods,
        findPod: (name: string, namespace: string) => {
          const current = mockState.pods.find((entry) => {
            return (
              entry.metadata.name === name &&
              entry.metadata.namespace === namespace
            )
          })
          if (current == null) {
            return { ok: false }
          }
          return { ok: true, value: current }
        },
        getReplicaSets: () => [],
        findReplicaSet: () => ({ ok: false }),
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
    }

    const observations: ControllerObservation[] = []
    const controller = new PodLifecycleController(eventBus, getState, {
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
