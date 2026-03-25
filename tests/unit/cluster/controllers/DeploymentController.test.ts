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
  createDeploymentUpdatedEvent,
  createReplicaSetCreatedEvent,
  createReplicaSetDeletedEvent,
  createReplicaSetUpdatedEvent,
  type DeploymentScaledEvent,
  type DeploymentUpdatedEvent,
  type ReplicaSetCreatedEvent,
  type ReplicaSetUpdatedEvent
} from '../../../../src/core/cluster/events/types'
import type { Deployment } from '../../../../src/core/cluster/ressources/Deployment'
import {
  createDeployment,
  generateTemplateHash
} from '../../../../src/core/cluster/ressources/Deployment'
import type { ReplicaSet } from '../../../../src/core/cluster/ressources/ReplicaSet'
import { createReplicaSet } from '../../../../src/core/cluster/ressources/ReplicaSet'
import { DeploymentController } from '../../../../src/core/control-plane/controllers/DeploymentController'
import type { AppEvent } from '../../../../src/core/events/AppEvent'

describe('DeploymentController', () => {
  let eventBus: EventBus
  let controller: DeploymentController
  let mockState: {
    deployments: Deployment[]
    replicaSets: ReplicaSet[]
  }
  let apiServer: ApiServerFacade

  const createTestDeployment = (name: string, replicas: number): Deployment => {
    return createDeployment({
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

  const createTestReplicaSet = (deploy: Deployment): ReplicaSet => {
    const templateHash = generateTemplateHash(deploy.spec.template)
    const rsName = `${deploy.metadata.name}-${templateHash.substring(0, 10)}`

    return createReplicaSet({
      name: rsName,
      namespace: deploy.metadata.namespace,
      replicas: deploy.spec.replicas ?? 1,
      selector: {
        matchLabels: {
          app: deploy.metadata.name,
          'pod-template-hash': templateHash.substring(0, 10)
        }
      },
      template: deploy.spec.template,
      ownerReferences: [
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: deploy.metadata.name,
          uid: `default-${deploy.metadata.name}`,
          controller: true
        }
      ]
    })
  }

  beforeEach(() => {
    eventBus = createEventBus()
    mockState = {
      deployments: [],
      replicaSets: []
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
        if (kind === 'ReplicaSet') {
          const replicaSet = resource as ReplicaSet
          mockState.replicaSets.push(replicaSet)
          eventBus.emit(createReplicaSetCreatedEvent(replicaSet, 'api-server'))
          return { ok: true, value: replicaSet }
        }
        return { ok: false, error: 'unsupported kind' }
      },
      updateResource: <TKind extends ResourceKind>(
        kind: TKind,
        name: string,
        resource: KindToResource<TKind>,
        namespace?: string
      ) => {
        if (kind === 'Deployment') {
          const deployment = resource as Deployment
          const index = mockState.deployments.findIndex((entry) => {
            return (
              entry.metadata.name === name &&
              entry.metadata.namespace === (namespace ?? 'default')
            )
          })
          if (index < 0) {
            return { ok: false, error: 'not found' }
          }
          const previous = mockState.deployments[index]
          mockState.deployments[index] = deployment
          eventBus.emit(
            createDeploymentUpdatedEvent(
              name,
              namespace ?? 'default',
              deployment,
              previous,
              'api-server'
            )
          )
          return { ok: true, value: deployment }
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
      deleteResource: <TKind extends ResourceKind>(
        kind: TKind,
        name: string,
        namespace?: string
      ) => {
        if (kind === 'ReplicaSet') {
          const index = mockState.replicaSets.findIndex((entry) => {
            return (
              entry.metadata.name === name &&
              entry.metadata.namespace === (namespace ?? 'default')
            )
          })
          if (index < 0) {
            return { ok: false, error: 'not found' }
          }
          const [deletedReplicaSet] = mockState.replicaSets.splice(index, 1)
          eventBus.emit(
            createReplicaSetDeletedEvent(
              name,
              namespace ?? 'default',
              deletedReplicaSet,
              'api-server'
            )
          )
          return { ok: true, value: deletedReplicaSet }
        }
        return { ok: false, error: 'unsupported kind' }
      },
      listResources: <TKind extends ResourceKind>(
        kind: TKind,
        namespace?: string
      ) => {
        if (kind === 'Deployment') {
          if (namespace == null) {
            return mockState.deployments
          }
          return mockState.deployments.filter((entry) => {
            return entry.metadata.namespace === namespace
          })
        }
        if (kind === 'ReplicaSet') {
          if (namespace == null) {
            return mockState.replicaSets
          }
          return mockState.replicaSets.filter((entry) => {
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
        if (kind === 'Deployment') {
          const deployment = mockState.deployments.find((entry) => {
            return (
              entry.metadata.name === name &&
              entry.metadata.namespace === (namespace ?? 'default')
            )
          })
          if (deployment == null) {
            return { ok: false, error: 'not found' }
          }
          return { ok: true, value: deployment }
        }
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
        return { ok: false, error: 'not found' }
      },
      clusterState: {
        getDeployments: (namespace?: string) =>
          namespace
            ? mockState.deployments.filter(
                (d) => d.metadata.namespace === namespace
              )
            : mockState.deployments,
        getReplicaSets: (namespace?: string) =>
          namespace
            ? mockState.replicaSets.filter(
                (rs) => rs.metadata.namespace === namespace
              )
            : mockState.replicaSets,
        findDeployment: (name: string, namespace: string) => {
          const deploy = mockState.deployments.find(
            (d) =>
              d.metadata.name === name && d.metadata.namespace === namespace
          )
          return deploy
            ? { ok: true, value: deploy }
            : { ok: false, error: 'not found' }
        },
        findReplicaSet: (name: string, namespace: string) => {
          const rs = mockState.replicaSets.find(
            (r) =>
              r.metadata.name === name && r.metadata.namespace === namespace
          )
          return rs
            ? { ok: true, value: rs }
            : { ok: false, error: 'not found' }
        },
        getDaemonSets: () => [],
        findDaemonSet: () => ({ ok: false, error: 'not found' }),
        getPods: () => [],
        findPod: () => ({ ok: false, error: 'not found' }),
        getNodes: () => [],
        getPersistentVolumes: () => [],
        findPersistentVolume: () => ({ ok: false, error: 'not found' }),
        getPersistentVolumeClaims: () => [],
        findPersistentVolumeClaim: () => ({ ok: false, error: 'not found' })
      }
    } as unknown as ApiServerFacade
    ;(apiServer as unknown as Record<string, unknown>).getClusterState = () =>
      (apiServer as unknown as Record<string, unknown>).clusterState

    controller = new DeploymentController(apiServer)
  })

  describe('reconcile', () => {
    it('should create ReplicaSet when Deployment has none', () => {
      const deploy = createTestDeployment('my-deploy', 3)
      mockState.deployments = [deploy]
      mockState.replicaSets = []

      let createdRs: ReplicaSet | undefined
      eventBus.subscribe(
        'ReplicaSetCreated',
        (event: ReplicaSetCreatedEvent) => {
          createdRs = event.payload.replicaSet
        }
      )

      controller.reconcile('default/my-deploy')

      expect(createdRs).toBeDefined()
      expect(createdRs!.metadata.name).toContain('my-deploy')
      expect(createdRs!.spec.replicas).toBe(3)
      expect(createdRs!.metadata.ownerReferences?.[0].name).toBe('my-deploy')
    })

    it('should emit scaling event when creating a new ReplicaSet', () => {
      const deploy = createTestDeployment('my-deploy', 3)
      mockState.deployments = [deploy]
      mockState.replicaSets = []
      let scalingEvent: DeploymentScaledEvent | undefined
      eventBus.subscribe('DeploymentScaled', (event: DeploymentScaledEvent) => {
        scalingEvent = event
      })

      controller.reconcile('default/my-deploy')

      expect(scalingEvent).toBeDefined()
      expect(scalingEvent?.payload.reason).toBe('ScalingReplicaSet')
      expect(scalingEvent?.payload.replicaSetName).toContain('my-deploy-')
      expect(scalingEvent?.payload.fromReplicas).toBe(0)
      expect(scalingEvent?.payload.toReplicas).toBe(3)
      expect(scalingEvent?.metadata.source).toBe('deployment-controller')
    })

    it('should update ReplicaSet replicas when Deployment replicas change', () => {
      const deploy = createTestDeployment('my-deploy', 5)
      const baseRs = createTestReplicaSet(deploy)
      // Create a mutable copy with old replicas value
      const existingRs = {
        ...baseRs,
        spec: { ...baseRs.spec, replicas: 3 }
      }

      mockState.deployments = [deploy]
      mockState.replicaSets = [existingRs]

      let updatedRs: ReplicaSet | undefined
      eventBus.subscribe(
        'ReplicaSetUpdated',
        (event: ReplicaSetUpdatedEvent) => {
          updatedRs = event.payload.replicaSet
        }
      )

      controller.reconcile('default/my-deploy')

      expect(updatedRs).toBeDefined()
      expect(updatedRs!.spec.replicas).toBe(5)
    })

    it('should do nothing when ReplicaSet matches Deployment spec', () => {
      const deploy = createTestDeployment('my-deploy', 3)
      const existingRs = createTestReplicaSet(deploy)

      mockState.deployments = [deploy]
      mockState.replicaSets = [existingRs]

      const rsCreated = vi.fn()
      eventBus.subscribe('ReplicaSetCreated', rsCreated)

      controller.reconcile('default/my-deploy')

      expect(rsCreated).not.toHaveBeenCalled()
    })

    it('should handle non-existent Deployment gracefully', () => {
      mockState.deployments = []

      const rsCreated = vi.fn()
      eventBus.subscribe('ReplicaSetCreated', rsCreated)

      controller.reconcile('default/non-existent')

      expect(rsCreated).not.toHaveBeenCalled()
    })

    it('should scale down old ReplicaSets when template changes', () => {
      const deploy = createTestDeployment('my-deploy', 3)

      // Create old RS with different template hash
      const oldRs = createReplicaSet({
        name: 'my-deploy-oldhashttt',
        namespace: 'default',
        replicas: 3,
        selector: { matchLabels: { app: 'my-deploy' } },
        template: {
          metadata: { labels: { app: 'my-deploy' } },
          spec: {
            containers: [{ name: 'nginx', image: 'nginx:1.18' }] // Different image
          }
        },
        ownerReferences: [
          {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            name: 'my-deploy',
            uid: 'default-my-deploy',
            controller: true
          }
        ]
      })

      mockState.deployments = [deploy]
      mockState.replicaSets = [oldRs]

      let createdRsCount = 0
      let scaleDownUpdate: ReplicaSet | undefined

      eventBus.subscribe(
        'ReplicaSetCreated',
        (event: ReplicaSetCreatedEvent) => {
          createdRsCount++
          expect(event.payload.replicaSet.spec.replicas).toBe(1)
        }
      )
      eventBus.subscribe(
        'ReplicaSetUpdated',
        (event: ReplicaSetUpdatedEvent) => {
          if (
            event.payload.replicaSet.metadata.name === 'my-deploy-oldhashttt' &&
            event.payload.replicaSet.spec.replicas < 3
          ) {
            scaleDownUpdate = event.payload.replicaSet
          }
        }
      )

      controller.reconcile('default/my-deploy')

      expect(createdRsCount).toBe(1)
      expect(scaleDownUpdate).toBeUndefined()
    })

    it('should update Deployment status from ReplicaSet status', () => {
      const baseDeploy = createTestDeployment('my-deploy', 2)
      const deploy = {
        ...baseDeploy,
        status: {
          replicas: 0,
          readyReplicas: 0,
          availableReplicas: 0,
          updatedReplicas: 0
        }
      }

      const baseRs = createTestReplicaSet(deploy)
      const rs = {
        ...baseRs,
        status: {
          replicas: 2,
          readyReplicas: 2,
          availableReplicas: 2,
          fullyLabeledReplicas: 2
        }
      }

      mockState.deployments = [deploy]
      mockState.replicaSets = [rs]

      let updatedDeploy: Deployment | undefined
      eventBus.subscribe(
        'DeploymentUpdated',
        (event: DeploymentUpdatedEvent) => {
          updatedDeploy = event.payload.deployment
        }
      )

      controller.reconcile('default/my-deploy')

      expect(updatedDeploy).toBeDefined()
      expect(updatedDeploy!.status.readyReplicas).toBe(2)
    })

    it('should not scale down old ReplicaSets before new ReplicaSet is available', () => {
      const deploy = createTestDeployment('my-deploy', 3)
      const oldRs = createReplicaSet({
        name: 'my-deploy-oldhashttt',
        namespace: 'default',
        replicas: 3,
        selector: { matchLabels: { app: 'my-deploy' } },
        template: {
          metadata: { labels: { app: 'my-deploy' } },
          spec: {
            containers: [{ name: 'nginx', image: 'nginx:1.18' }]
          }
        },
        ownerReferences: [
          {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            name: 'my-deploy',
            uid: 'default-my-deploy',
            controller: true
          }
        ]
      })
      const currentRsBase = createTestReplicaSet(deploy)
      const currentRs: ReplicaSet = {
        ...currentRsBase,
        spec: {
          ...currentRsBase.spec,
          replicas: 1
        },
        status: {
          ...currentRsBase.status,
          replicas: 1,
          readyReplicas: 0,
          availableReplicas: 0
        }
      }

      mockState.deployments = [deploy]
      mockState.replicaSets = [currentRs, oldRs]

      const oldScaleDownUpdates: ReplicaSet[] = []
      eventBus.subscribe(
        'ReplicaSetUpdated',
        (event: ReplicaSetUpdatedEvent) => {
          if (event.payload.replicaSet.metadata.name === oldRs.metadata.name) {
            oldScaleDownUpdates.push(event.payload.replicaSet)
          }
        }
      )

      controller.reconcile('default/my-deploy')

      expect(oldScaleDownUpdates.length).toBe(0)
    })

    it('should scale down non-current ReplicaSets and sync revision on rollback', () => {
      const deploymentTemplateA = createDeployment({
        name: 'my-deploy',
        namespace: 'default',
        replicas: 3,
        selector: { matchLabels: { app: 'my-deploy' } },
        template: {
          metadata: { labels: { app: 'my-deploy' } },
          spec: {
            containers: [{ name: 'nginx', image: 'nginx:1.18' }]
          }
        },
        annotations: {
          'deployment.kubernetes.io/revision': '2'
        }
      })
      const deploymentTemplateB = createDeployment({
        name: 'my-deploy',
        namespace: 'default',
        replicas: 3,
        selector: { matchLabels: { app: 'my-deploy' } },
        template: {
          metadata: { labels: { app: 'my-deploy' } },
          spec: {
            containers: [{ name: 'nginx', image: 'nginx:1.19' }]
          }
        }
      })

      const baseCurrentRsA = createTestReplicaSet(deploymentTemplateA)
      const baseOldActiveRsB = createTestReplicaSet(deploymentTemplateB)
      const currentRsA: ReplicaSet = {
        ...baseCurrentRsA,
        spec: {
          ...baseCurrentRsA.spec,
          replicas: 0
        },
        metadata: {
          ...baseCurrentRsA.metadata,
          annotations: {
            'deployment.kubernetes.io/revision': '1'
          }
        }
      }
      const oldActiveRsB: ReplicaSet = {
        ...baseOldActiveRsB,
        spec: {
          ...baseOldActiveRsB.spec,
          replicas: 3
        },
        metadata: {
          ...baseOldActiveRsB.metadata,
          annotations: {
            'deployment.kubernetes.io/revision': '2'
          }
        }
      }

      mockState.deployments = [deploymentTemplateA]
      mockState.replicaSets = [currentRsA, oldActiveRsB]

      const updatedReplicaSets: ReplicaSet[] = []
      const updatedDeployments: Deployment[] = []

      eventBus.subscribe(
        'ReplicaSetUpdated',
        (event: ReplicaSetUpdatedEvent) => {
          updatedReplicaSets.push(event.payload.replicaSet)
        }
      )
      eventBus.subscribe(
        'DeploymentUpdated',
        (event: DeploymentUpdatedEvent) => {
          updatedDeployments.push(event.payload.deployment)
        }
      )

      controller.reconcile('default/my-deploy')

      const rsAUpdatedTo1 = updatedReplicaSets.some((rs) => {
        return (
          rs.metadata.name === currentRsA.metadata.name &&
          rs.spec.replicas === 1
        )
      })
      const rsBUpdatedTo2 = updatedReplicaSets.some((rs) => {
        return (
          rs.metadata.name === oldActiveRsB.metadata.name &&
          rs.spec.replicas === 2
        )
      })
      const deploymentRevisionUpdated = updatedDeployments.some(
        (deployment) => {
          return (
            deployment.metadata.annotations?.[
              'deployment.kubernetes.io/revision'
            ] === '1'
          )
        }
      )

      expect(rsAUpdatedTo1).toBe(true)
      expect(rsBUpdatedTo2).toBe(false)
      expect(deploymentRevisionUpdated).toBe(true)
    })
  })

  describe('start and stop', () => {
    it('should start the work queue', () => {
      controller.start()
      controller.stop()
    })

    it('should stop processing after stop()', () => {
      controller.start()
      controller.stop()

      const deploy = createTestDeployment('my-deploy', 2)
      mockState.deployments = [deploy]

      const rsCreated = vi.fn()
      eventBus.subscribe('ReplicaSetCreated', rsCreated)

      // Manual reconcile should still work
      controller.reconcile('default/my-deploy')
      expect(rsCreated).toHaveBeenCalledTimes(1)
    })
  })

  describe('periodic resync', () => {
    it('should heal stale Deployment status without new ReplicaSet events', () => {
      vi.useFakeTimers()
      const deployment = {
        ...createTestDeployment('my-deploy', 2),
        status: {
          replicas: 2,
          readyReplicas: 0,
          availableReplicas: 0,
          updatedReplicas: 2
        }
      }
      const replicaSet = {
        ...createTestReplicaSet(deployment),
        status: {
          replicas: 2,
          readyReplicas: 2,
          availableReplicas: 2,
          fullyLabeledReplicas: 2
        }
      }
      mockState.deployments = [deployment]
      mockState.replicaSets = [replicaSet]
      controller = new DeploymentController(apiServer, {
        resyncIntervalMs: 50
      })

      const updates: number[] = []
      eventBus.subscribe(
        'DeploymentUpdated',
        (event: DeploymentUpdatedEvent) => {
          updates.push(event.payload.deployment.status.readyReplicas ?? 0)
          mockState.deployments = [event.payload.deployment]
        }
      )

      controller.start()
      vi.advanceTimersByTime(1)

      mockState.deployments = [
        {
          ...mockState.deployments[0],
          status: {
            replicas: 2,
            readyReplicas: 0,
            availableReplicas: 0,
            updatedReplicas: 2
          }
        }
      ]

      vi.advanceTimersByTime(50)
      controller.stop()
      vi.useRealTimers()

      expect(
        updates.filter((value) => value === 2).length
      ).toBeGreaterThanOrEqual(2)
    })
  })
})
