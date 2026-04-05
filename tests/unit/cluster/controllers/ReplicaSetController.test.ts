import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiServerFacade } from '../../../../src/core/api/ApiServerFacade'
import type {
  KindToResource,
  ResourceKind
} from '../../../../src/core/cluster/ClusterState'
import {
  createEventBus,
  type EventBus
} from '../../../../src/core/cluster/events/EventBus'
import {
  createPodCreatedEvent,
  createPodDeletedEvent,
  createReplicaSetUpdatedEvent,
  createPodUpdatedEvent,
  type PodCreatedEvent,
  type PodDeletedEvent,
  type PodUpdatedEvent,
  type ReplicaSetUpdatedEvent
} from '../../../../src/core/cluster/events/types'
import type { Pod } from '../../../../src/core/cluster/ressources/Pod'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'
import type { ReplicaSet } from '../../../../src/core/cluster/ressources/ReplicaSet'
import { createReplicaSet } from '../../../../src/core/cluster/ressources/ReplicaSet'
import { ReplicaSetController } from '../../../../src/core/control-plane/controllers/ReplicaSetController'
import type { AppEvent } from '../../../../src/core/events/AppEvent'

describe('ReplicaSetController', () => {
  let eventBus: EventBus
  let controller: ReplicaSetController
  let mockState: {
    replicaSets: ReplicaSet[]
    pods: Pod[]
  }
  let apiServer: ApiServerFacade

  const createTestReplicaSet = (name: string, replicas: number): ReplicaSet => {
    return createReplicaSet({
      name,
      namespace: 'default',
      replicas,
      selector: { matchLabels: { app: name } },
      template: {
        metadata: { labels: { app: name } },
        spec: {
          containers: [{ name: 'nginx', image: 'nginx:latest' }]
        }
      }
    })
  }

  const createTestPod = (
    name: string,
    ownerRsName: string,
    phase: Pod['status']['phase'] = 'Running'
  ): Pod => {
    return createPod({
      name,
      namespace: 'default',
      containers: [{ name: 'nginx', image: 'nginx:latest' }],
      labels: { app: ownerRsName },
      phase,
      ownerReferences: [
        {
          apiVersion: 'apps/v1',
          kind: 'ReplicaSet',
          name: ownerRsName,
          uid: `default-${ownerRsName}`,
          controller: true
        }
      ]
    })
  }

  beforeEach(() => {
    eventBus = createEventBus()
    mockState = {
      replicaSets: [],
      pods: []
    }

    apiServer = {
      eventBus,
      getEventBus: () => eventBus,
      emitEvent: (event: AppEvent) => {
        eventBus.emit(event)
      },
      createResource: <TKind extends ResourceKind>(
        kind: TKind,
        resource: KindToResource<TKind>,
        _namespace?: string
      ) => {
        if (kind === 'Pod') {
          const pod = resource as Pod
          mockState.pods.push(pod)
          eventBus.emit(createPodCreatedEvent(pod, 'api-server'))
          return { ok: true, value: pod }
        }
        return { ok: false, error: 'unsupported kind' }
      },
      deleteResource: <TKind extends ResourceKind>(
        kind: TKind,
        name: string,
        namespace?: string
      ) => {
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
      updateResource: <TKind extends ResourceKind>(
        kind: TKind,
        name: string,
        resource: KindToResource<TKind>,
        namespace?: string
      ) => {
        if (kind === 'Pod') {
          const pod = resource as Pod
          const index = mockState.pods.findIndex((entry) => {
            return (
              entry.metadata.name === name &&
              entry.metadata.namespace === (namespace ?? 'default')
            )
          })
          if (index < 0) {
            return { ok: false, error: 'not found' }
          }
          const previous = mockState.pods[index]
          mockState.pods[index] = pod
          eventBus.emit(
            createPodUpdatedEvent(
              name,
              namespace ?? 'default',
              pod,
              previous,
              'api-server'
            )
          )
          return { ok: true, value: pod }
        }
        if (kind === 'ReplicaSet') {
          const replicaSet = resource as ReplicaSet
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
          mockState.replicaSets[index] = replicaSet
          eventBus.emit(
            createReplicaSetUpdatedEvent(
              name,
              namespace ?? 'default',
              replicaSet,
              previous,
              'api-server'
            )
          )
          return { ok: true, value: replicaSet }
        }
        return { ok: false, error: 'unsupported kind' }
      },
      listResources: <TKind extends ResourceKind>(
        kind: TKind,
        namespace?: string
      ) => {
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
      findResource: <TKind extends ResourceKind>(
        kind: TKind,
        name: string,
        namespace?: string
      ) => {
        if (kind === 'ReplicaSet') {
          const replicaSet = mockState.replicaSets.find((entry) => {
            return (
              entry.metadata.name === name &&
              entry.metadata.namespace === (namespace ?? 'default')
            )
          })
          if (replicaSet == null) {
            return { ok: false, error: 'not found' }
          }
          return { ok: true, value: replicaSet }
        }
        if (kind === 'Pod') {
          const pod = mockState.pods.find((entry) => {
            return (
              entry.metadata.name === name &&
              entry.metadata.namespace === (namespace ?? 'default')
            )
          })
          if (pod == null) {
            return { ok: false, error: 'not found' }
          }
          return { ok: true, value: pod }
        }
        return { ok: false, error: 'not found' }
      },
      clusterState: {
        getReplicaSets: (namespace?: string) =>
          namespace
            ? mockState.replicaSets.filter(
                (rs) => rs.metadata.namespace === namespace
              )
            : mockState.replicaSets,
        getPods: (namespace?: string) =>
          namespace
            ? mockState.pods.filter((p) => p.metadata.namespace === namespace)
            : mockState.pods,
        findReplicaSet: (name: string, namespace: string) => {
          const rs = mockState.replicaSets.find(
            (r) =>
              r.metadata.name === name && r.metadata.namespace === namespace
          )
          return rs
            ? { ok: true, value: rs }
            : { ok: false, error: 'not found' }
        },
        findPod: (name: string, namespace: string) => {
          const pod = mockState.pods.find(
            (p) =>
              p.metadata.name === name && p.metadata.namespace === namespace
          )
          return pod
            ? { ok: true, value: pod }
            : { ok: false, error: 'not found' }
        },
        getDeployments: () => [],
        findDeployment: () => ({ ok: false, error: 'not found' }),
        getDaemonSets: () => [],
        findDaemonSet: () => ({ ok: false, error: 'not found' }),
        getNodes: () => [],
        getPersistentVolumes: () => [],
        findPersistentVolume: () => ({ ok: false, error: 'not found' }),
        getPersistentVolumeClaims: () => [],
        findPersistentVolumeClaim: () => ({ ok: false, error: 'not found' })
      }
    } as unknown as ApiServerFacade
    ;(apiServer as unknown as Record<string, unknown>).getClusterState = () =>
      (apiServer as unknown as Record<string, unknown>).clusterState

    controller = new ReplicaSetController(apiServer)
  })

  describe('reconcile', () => {
    it('should create pods when ReplicaSet has fewer pods than desired', () => {
      const rs = createTestReplicaSet('my-rs', 3)
      mockState.replicaSets = [rs]
      mockState.pods = []

      const createdPods: Pod[] = []
      eventBus.subscribe('PodCreated', (event: PodCreatedEvent) => {
        createdPods.push(event.payload.pod)
      })

      controller.reconcile('default/my-rs')

      expect(createdPods).toHaveLength(3)
      createdPods.forEach((pod) => {
        expect(pod.metadata.name).toContain('my-rs')
        expect(pod.metadata.ownerReferences?.[0].name).toBe('my-rs')
      })
    })

    it('should propagate probe configuration from pod template', () => {
      const rs = createReplicaSet({
        name: 'probed-rs',
        namespace: 'default',
        replicas: 1,
        selector: { matchLabels: { app: 'probed-rs' } },
        template: {
          metadata: { labels: { app: 'probed-rs' } },
          spec: {
            containers: [
              {
                name: 'web',
                image: 'nginx:1.28',
                livenessProbe: {
                  httpGet: {
                    path: '/',
                    port: 80
                  },
                  initialDelaySeconds: 5,
                  periodSeconds: 10,
                  failureThreshold: 3
                },
                readinessProbe: {
                  httpGet: {
                    path: '/',
                    port: 80
                  },
                  initialDelaySeconds: 3,
                  periodSeconds: 5,
                  failureThreshold: 2
                }
              }
            ]
          }
        }
      })
      mockState.replicaSets = [rs]
      mockState.pods = []

      controller.reconcile('default/probed-rs')

      expect(mockState.pods).toHaveLength(1)
      expect(mockState.pods[0].spec.containers[0].livenessProbe).toEqual({
        type: 'httpGet',
        path: '/',
        port: 80,
        initialDelaySeconds: 5,
        periodSeconds: 10,
        failureThreshold: 3
      })
      expect(mockState.pods[0].spec.containers[0].readinessProbe).toEqual({
        type: 'httpGet',
        path: '/',
        port: 80,
        initialDelaySeconds: 3,
        periodSeconds: 5,
        failureThreshold: 2
      })
    })

    it('should delete pods when ReplicaSet has more pods than desired', () => {
      const rs = createTestReplicaSet('my-rs', 1)
      mockState.replicaSets = [rs]
      mockState.pods = [
        createTestPod('my-rs-abc12', 'my-rs'),
        createTestPod('my-rs-def34', 'my-rs'),
        createTestPod('my-rs-ghi56', 'my-rs')
      ]

      const deletedPods: string[] = []
      eventBus.subscribe('PodDeleted', (event: PodDeletedEvent) => {
        deletedPods.push(event.payload.name)
      })

      controller.reconcile('default/my-rs')

      expect(deletedPods).toHaveLength(2)
    })

    it('should do nothing when pod count matches desired replicas', () => {
      const rs = createTestReplicaSet('my-rs', 2)
      mockState.replicaSets = [rs]
      mockState.pods = [
        createTestPod('my-rs-abc12', 'my-rs'),
        createTestPod('my-rs-def34', 'my-rs')
      ]

      const podCreated = vi.fn()
      const podDeleted = vi.fn()
      eventBus.subscribe('PodCreated', podCreated)
      eventBus.subscribe('PodDeleted', podDeleted)

      controller.reconcile('default/my-rs')

      expect(podCreated).not.toHaveBeenCalled()
      expect(podDeleted).not.toHaveBeenCalled()
    })

    it('should ignore Failed pods and create new ones to reach desired replicas', () => {
      const rs = createTestReplicaSet('my-rs', 1)
      mockState.replicaSets = [rs]
      mockState.pods = [createTestPod('my-rs-failed', 'my-rs', 'Failed')]

      const createdPods: Pod[] = []
      eventBus.subscribe('PodCreated', (event: PodCreatedEvent) => {
        createdPods.push(event.payload.pod)
      })

      controller.reconcile('default/my-rs')

      expect(createdPods).toHaveLength(1)
      expect(createdPods[0].metadata.ownerReferences?.[0].name).toBe('my-rs')
    })

    it('should ignore Terminating pods and create replacements', () => {
      const rs = createTestReplicaSet('my-rs', 1)
      mockState.replicaSets = [rs]
      mockState.pods = [
        createPod({
          name: 'my-rs-terminating',
          namespace: 'default',
          containers: [{ name: 'nginx', image: 'nginx:latest' }],
          labels: { app: 'my-rs' },
          ownerReferences: [
            {
              apiVersion: 'apps/v1',
              kind: 'ReplicaSet',
              name: 'my-rs',
              uid: 'default-my-rs',
              controller: true
            }
          ],
          phase: 'Running',
          deletionTimestamp: '2026-04-04T19:00:00.000Z'
        })
      ]

      const createdPods: Pod[] = []
      eventBus.subscribe('PodCreated', (event: PodCreatedEvent) => {
        createdPods.push(event.payload.pod)
      })

      controller.reconcile('default/my-rs')

      expect(createdPods).toHaveLength(1)
      expect(createdPods[0].metadata.ownerReferences?.[0].name).toBe('my-rs')
    })

    it('should handle non-existent ReplicaSet gracefully', () => {
      mockState.replicaSets = []

      const podCreated = vi.fn()
      eventBus.subscribe('PodCreated', podCreated)

      controller.reconcile('default/non-existent')

      expect(podCreated).not.toHaveBeenCalled()
    })

    it('should update ReplicaSet status after reconciliation', () => {
      const rs = {
        ...createTestReplicaSet('my-rs', 2),
        status: {
          replicas: 0,
          readyReplicas: 0,
          availableReplicas: 0,
          fullyLabeledReplicas: 0
        }
      }
      mockState.replicaSets = [rs]
      mockState.pods = [
        createTestPod('my-rs-abc12', 'my-rs'),
        createTestPod('my-rs-def34', 'my-rs')
      ]

      let updatedRs: ReplicaSet | undefined
      eventBus.subscribe(
        'ReplicaSetUpdated',
        (event: ReplicaSetUpdatedEvent) => {
          updatedRs = event.payload.replicaSet
        }
      )

      controller.reconcile('default/my-rs')

      expect(updatedRs).toBeDefined()
      expect(updatedRs!.status.replicas).toBe(2)
      expect(updatedRs!.status.readyReplicas).toBe(2)
    })

    it('should exclude terminal pods from ReplicaSet status replicas', () => {
      const rs = {
        ...createTestReplicaSet('my-rs', 1),
        status: {
          replicas: 1,
          readyReplicas: 1,
          availableReplicas: 1,
          fullyLabeledReplicas: 1
        }
      }
      mockState.replicaSets = [rs]
      mockState.pods = [createTestPod('my-rs-failed', 'my-rs', 'Failed')]

      let updatedRs: ReplicaSet | undefined
      eventBus.subscribe(
        'ReplicaSetUpdated',
        (event: ReplicaSetUpdatedEvent) => {
          updatedRs = event.payload.replicaSet
        }
      )

      controller.reconcile('default/my-rs')

      expect(updatedRs).toBeDefined()
      expect(updatedRs!.status.replicas).toBe(0)
      expect(updatedRs!.status.readyReplicas).toBe(0)
      expect(updatedRs!.status.availableReplicas).toBe(0)
      expect(updatedRs!.status.fullyLabeledReplicas).toBe(0)
    })

    it('should ignore unowned pods that do not match the ReplicaSet selector', () => {
      const rs = createTestReplicaSet('my-rs', 2)
      mockState.replicaSets = [rs]
      // One owned pod, two unowned pods
      mockState.pods = [
        createTestPod('my-rs-abc12', 'my-rs'),
        createPod({
          name: 'other-pod-1',
          namespace: 'default',
          containers: [{ name: 'nginx', image: 'nginx' }]
        }),
        createPod({
          name: 'other-pod-2',
          namespace: 'default',
          containers: [{ name: 'nginx', image: 'nginx' }]
        })
      ]

      let createdPodsCount = 0
      eventBus.subscribe('PodCreated', () => {
        createdPodsCount++
      })

      controller.reconcile('default/my-rs')

      // Should create 1 more pod (2 desired - 1 owned = 1 to create)
      expect(createdPodsCount).toBe(1)
    })

    it('should release ownerReference when owned pod no longer matches selector', () => {
      const rs = createTestReplicaSet('my-rs', 1)
      const detachedOwnedPod = createPod({
        name: 'my-rs-detached',
        namespace: 'default',
        containers: [{ name: 'nginx', image: 'nginx:latest' }],
        labels: { detached: 'true' },
        phase: 'Running',
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
      mockState.replicaSets = [rs]
      mockState.pods = [detachedOwnedPod]

      const updatedPods: Pod[] = []
      const createdPods: Pod[] = []
      eventBus.subscribe('PodUpdated', (event: PodUpdatedEvent) => {
        updatedPods.push(event.payload.pod)
      })
      eventBus.subscribe('PodCreated', (event: PodCreatedEvent) => {
        createdPods.push(event.payload.pod)
      })

      controller.reconcile('default/my-rs')

      expect(updatedPods.length).toBeGreaterThan(0)
      const releasedPod = updatedPods.find((pod) => {
        return pod.metadata.name === 'my-rs-detached'
      })
      expect(releasedPod).toBeDefined()
      expect(releasedPod?.metadata.ownerReferences).toBeUndefined()
      expect(createdPods.length).toBe(1)
    })

    it('should prefer deleting unowned matching pods when above desired replicas', () => {
      const rs = createTestReplicaSet('my-rs', 2)
      mockState.replicaSets = [rs]
      mockState.pods = [
        createTestPod('my-rs-owned-a', 'my-rs'),
        createTestPod('my-rs-owned-b', 'my-rs'),
        createPod({
          name: 'intruder',
          namespace: 'default',
          labels: { app: 'my-rs' },
          containers: [{ name: 'nginx', image: 'nginx:latest' }],
          phase: 'Running'
        })
      ]

      const deletedPods: string[] = []
      eventBus.subscribe('PodDeleted', (event: PodDeletedEvent) => {
        deletedPods.push(event.payload.name)
      })

      controller.reconcile('default/my-rs')

      expect(deletedPods).toHaveLength(1)
      expect(deletedPods[0]).toBe('intruder')
    })
  })

  describe('start and stop', () => {
    it('should start the work queue', () => {
      controller.start()
      // If it doesn't throw, it started successfully
      controller.stop()
    })

    it('should stop processing after stop()', () => {
      controller.start()
      controller.stop()

      // Add a RS and emit event - should not process
      const rs = createTestReplicaSet('my-rs', 2)
      mockState.replicaSets = [rs]

      const podCreated = vi.fn()
      eventBus.subscribe('PodCreated', podCreated)

      // Manually call reconcile should still work
      controller.reconcile('default/my-rs')
      expect(podCreated).toHaveBeenCalledTimes(2)
    })

    it('should reconcile matching ReplicaSet when an unowned matching pod is created', async () => {
      const rs = createTestReplicaSet('my-rs', 2)
      mockState.replicaSets = [rs]
      mockState.pods = [
        createTestPod('my-rs-owned-a', 'my-rs'),
        createTestPod('my-rs-owned-b', 'my-rs')
      ]

      const deletedPods: string[] = []
      eventBus.subscribe('PodDeleted', (event: PodDeletedEvent) => {
        deletedPods.push(event.payload.name)
      })

      controller.start()
      const intruder = createPod({
        name: 'intruder',
        namespace: 'default',
        labels: { app: 'my-rs' },
        containers: [{ name: 'nginx', image: 'nginx:latest' }],
        phase: 'Running'
      })
      mockState.pods.push(intruder)
      eventBus.emit(createPodCreatedEvent(intruder, 'test'))

      await new Promise((resolve) => setTimeout(resolve, 25))
      controller.stop()

      expect(deletedPods).toContain('intruder')
    })

    it('should reconcile owning ReplicaSet when a pod transitions via PodUpdated', async () => {
      const rs = {
        ...createTestReplicaSet('my-rs', 1),
        status: {
          replicas: 1,
          readyReplicas: 0,
          availableReplicas: 0,
          fullyLabeledReplicas: 1
        }
      }
      const pendingPod = createPod({
        name: 'my-rs-pending',
        namespace: 'default',
        containers: [{ name: 'nginx', image: 'nginx:latest' }],
        labels: { app: 'my-rs' },
        phase: 'Pending',
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
      mockState.replicaSets = [rs]
      mockState.pods = [pendingPod]

      const updatedStatuses: number[] = []
      eventBus.subscribe(
        'ReplicaSetUpdated',
        (event: ReplicaSetUpdatedEvent) => {
          updatedStatuses.push(
            event.payload.replicaSet.status.readyReplicas ?? 0
          )
        }
      )

      controller.start()

      const runningPod = createPod({
        name: pendingPod.metadata.name,
        namespace: pendingPod.metadata.namespace,
        containers: [{ name: 'nginx', image: 'nginx:latest' }],
        labels: pendingPod.metadata.labels,
        phase: 'Running',
        ownerReferences: pendingPod.metadata.ownerReferences
      })
      mockState.pods = [runningPod]
      eventBus.emit(
        createPodUpdatedEvent(
          runningPod.metadata.name,
          runningPod.metadata.namespace,
          runningPod,
          pendingPod,
          'test'
        )
      )

      await new Promise((resolve) => setTimeout(resolve, 25))
      controller.stop()

      expect(updatedStatuses).toContain(1)
    })

    it('should create a replacement immediately when pod labels stop matching selector', async () => {
      const rs = createTestReplicaSet('my-rs', 1)
      const matchingPod = createTestPod('my-rs-a', 'my-rs')
      mockState.replicaSets = [rs]
      mockState.pods = [matchingPod]

      const createdPodNames: string[] = []
      eventBus.subscribe('PodCreated', (event: PodCreatedEvent) => {
        createdPodNames.push(event.payload.pod.metadata.name)
      })

      controller.start()

      const unlabeledPod = createPod({
        name: matchingPod.metadata.name,
        namespace: matchingPod.metadata.namespace,
        containers: [{ name: 'nginx', image: 'nginx:latest' }],
        labels: { detached: 'true' },
        phase: 'Running',
        ownerReferences: matchingPod.metadata.ownerReferences
      })
      mockState.pods = [unlabeledPod]
      eventBus.emit(
        createPodUpdatedEvent(
          unlabeledPod.metadata.name,
          unlabeledPod.metadata.namespace,
          unlabeledPod,
          matchingPod,
          'test'
        )
      )

      await new Promise((resolve) => setTimeout(resolve, 25))
      controller.stop()

      expect(createdPodNames.length).toBeGreaterThan(0)
    })
  })

  describe('periodic resync', () => {
    it('should heal stale ReplicaSet status without new pod events', () => {
      vi.useFakeTimers()
      const rs = {
        ...createTestReplicaSet('my-rs', 1),
        status: {
          replicas: 1,
          readyReplicas: 0,
          availableReplicas: 0,
          fullyLabeledReplicas: 1
        }
      }
      const runningPod = createTestPod('my-rs-a', 'my-rs')
      mockState.replicaSets = [rs]
      mockState.pods = [runningPod]
      controller = new ReplicaSetController(apiServer, {
        resyncIntervalMs: 50
      })

      const updates: number[] = []
      eventBus.subscribe(
        'ReplicaSetUpdated',
        (event: ReplicaSetUpdatedEvent) => {
          updates.push(event.payload.replicaSet.status.readyReplicas ?? 0)
          mockState.replicaSets = [event.payload.replicaSet]
        }
      )

      controller.start()
      vi.advanceTimersByTime(1)

      mockState.replicaSets = [
        {
          ...mockState.replicaSets[0],
          status: {
            replicas: 1,
            readyReplicas: 0,
            availableReplicas: 0,
            fullyLabeledReplicas: 1
          }
        }
      ]

      vi.advanceTimersByTime(50)
      controller.stop()
      vi.useRealTimers()

      expect(
        updates.filter((value) => value === 1).length
      ).toBeGreaterThanOrEqual(2)
    })
  })
})
