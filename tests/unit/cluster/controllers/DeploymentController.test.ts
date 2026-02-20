import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createEventBus,
  type EventBus
} from '../../../../src/core/cluster/events/EventBus'
import type {
  DeploymentUpdatedEvent,
  ReplicaSetCreatedEvent,
  ReplicaSetUpdatedEvent
} from '../../../../src/core/cluster/events/types'
import type { Deployment } from '../../../../src/core/cluster/ressources/Deployment'
import {
  createDeployment,
  generateTemplateHash
} from '../../../../src/core/cluster/ressources/Deployment'
import type { ReplicaSet } from '../../../../src/core/cluster/ressources/ReplicaSet'
import { createReplicaSet } from '../../../../src/core/cluster/ressources/ReplicaSet'
import { DeploymentController } from '../../../../src/core/cluster/controllers/DeploymentController'
import type { ControllerState } from '../../../../src/core/cluster/controllers/types'

describe('DeploymentController', () => {
  let eventBus: EventBus
  let controller: DeploymentController
  let mockState: {
    deployments: Deployment[]
    replicaSets: ReplicaSet[]
  }
  let getState: () => ControllerState

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

    getState = () => ({
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
          (d) => d.metadata.name === name && d.metadata.namespace === namespace
        )
        return deploy
          ? { ok: true, value: deploy }
          : { ok: false, error: 'not found' }
      },
      findReplicaSet: (name: string, namespace: string) => {
        const rs = mockState.replicaSets.find(
          (r) => r.metadata.name === name && r.metadata.namespace === namespace
        )
        return rs ? { ok: true, value: rs } : { ok: false, error: 'not found' }
      },
      getDaemonSets: () => [],
      findDaemonSet: () => ({ ok: false, error: 'not found' }),
      getPods: () => [],
      findPod: () => ({ ok: false, error: 'not found' }),
      getNodes: () => []
    })

    controller = new DeploymentController(eventBus, getState)
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
          expect(event.payload.replicaSet.spec.replicas).toBe(3)
        }
      )
      eventBus.subscribe(
        'ReplicaSetUpdated',
        (event: ReplicaSetUpdatedEvent) => {
          if (
            event.payload.replicaSet.metadata.name === 'my-deploy-oldhashttt' &&
            event.payload.replicaSet.spec.replicas === 0
          ) {
            scaleDownUpdate = event.payload.replicaSet
          }
        }
      )

      controller.reconcile('default/my-deploy')

      expect(createdRsCount).toBe(1)
      expect(scaleDownUpdate).toBeDefined()
      expect(scaleDownUpdate?.spec.replicas).toBe(0)
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
})
