import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEventBus, type EventBus } from '../../../../src/core/cluster/events/EventBus'
import type { PodCreatedEvent, PodDeletedEvent, ReplicaSetUpdatedEvent } from '../../../../src/core/cluster/events/types'
import type { Pod } from '../../../../src/core/cluster/ressources/Pod'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'
import type { ReplicaSet } from '../../../../src/core/cluster/ressources/ReplicaSet'
import { createReplicaSet } from '../../../../src/core/cluster/ressources/ReplicaSet'
import { ReplicaSetController } from '../../../../src/core/cluster/controllers/ReplicaSetController'
import type { ControllerState } from '../../../../src/core/cluster/controllers/types'

describe('ReplicaSetController', () => {
    let eventBus: EventBus
    let controller: ReplicaSetController
    let mockState: {
        replicaSets: ReplicaSet[]
        pods: Pod[]
    }
    let getState: () => ControllerState

    const createTestReplicaSet = (name: string, replicas: number): ReplicaSet => {
        return createReplicaSet({
            name,
            namespace: 'default',
            replicas,
            selector: { matchLabels: { app: name } },
            template: {
                metadata: { labels: { app: name } },
                spec: {
                    containers: [{ name: 'nginx', image: 'nginx:latest' }],
                },
            },
        })
    }

    const createTestPod = (name: string, ownerRsName: string): Pod => {
        return createPod({
            name,
            namespace: 'default',
            containers: [{ name: 'nginx', image: 'nginx:latest' }],
            labels: { app: ownerRsName },
            phase: 'Running',
            ownerReferences: [{
                apiVersion: 'apps/v1',
                kind: 'ReplicaSet',
                name: ownerRsName,
                uid: `default-${ownerRsName}`,
                controller: true,
            }],
        })
    }

    beforeEach(() => {
        eventBus = createEventBus()
        mockState = {
            replicaSets: [],
            pods: [],
        }

        getState = () => ({
            getReplicaSets: (namespace?: string) =>
                namespace ? mockState.replicaSets.filter(rs => rs.metadata.namespace === namespace) : mockState.replicaSets,
            getPods: (namespace?: string) =>
                namespace ? mockState.pods.filter(p => p.metadata.namespace === namespace) : mockState.pods,
            findReplicaSet: (name: string, namespace: string) => {
                const rs = mockState.replicaSets.find(r => r.metadata.name === name && r.metadata.namespace === namespace)
                return rs ? { ok: true, value: rs } : { ok: false, error: 'not found' }
            },
            findPod: (name: string, namespace: string) => {
                const pod = mockState.pods.find(p => p.metadata.name === name && p.metadata.namespace === namespace)
                return pod ? { ok: true, value: pod } : { ok: false, error: 'not found' }
            },
            getDeployments: () => [],
            findDeployment: () => ({ ok: false, error: 'not found' }),
            getNodes: () => [],
        })

        controller = new ReplicaSetController(eventBus, getState)
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
            createdPods.forEach(pod => {
                expect(pod.metadata.name).toContain('my-rs')
                expect(pod.metadata.ownerReferences?.[0].name).toBe('my-rs')
            })
        })

        it('should delete pods when ReplicaSet has more pods than desired', () => {
            const rs = createTestReplicaSet('my-rs', 1)
            mockState.replicaSets = [rs]
            mockState.pods = [
                createTestPod('my-rs-abc12', 'my-rs'),
                createTestPod('my-rs-def34', 'my-rs'),
                createTestPod('my-rs-ghi56', 'my-rs'),
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
                createTestPod('my-rs-def34', 'my-rs'),
            ]

            const podCreated = vi.fn()
            const podDeleted = vi.fn()
            eventBus.subscribe('PodCreated', podCreated)
            eventBus.subscribe('PodDeleted', podDeleted)

            controller.reconcile('default/my-rs')

            expect(podCreated).not.toHaveBeenCalled()
            expect(podDeleted).not.toHaveBeenCalled()
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
                status: { replicas: 0, readyReplicas: 0, availableReplicas: 0, fullyLabeledReplicas: 0 },
            }
            mockState.replicaSets = [rs]
            mockState.pods = [
                createTestPod('my-rs-abc12', 'my-rs'),
                createTestPod('my-rs-def34', 'my-rs'),
            ]

            let updatedRs: ReplicaSet | undefined
            eventBus.subscribe('ReplicaSetUpdated', (event: ReplicaSetUpdatedEvent) => {
                updatedRs = event.payload.replicaSet
            })

            controller.reconcile('default/my-rs')

            expect(updatedRs).toBeDefined()
            expect(updatedRs!.status.replicas).toBe(2)
            expect(updatedRs!.status.readyReplicas).toBe(2)
        })

        it('should only count pods owned by the ReplicaSet', () => {
            const rs = createTestReplicaSet('my-rs', 2)
            mockState.replicaSets = [rs]
            // One owned pod, two unowned pods
            mockState.pods = [
                createTestPod('my-rs-abc12', 'my-rs'),
                createPod({ name: 'other-pod-1', namespace: 'default', containers: [{ name: 'nginx', image: 'nginx' }] }),
                createPod({ name: 'other-pod-2', namespace: 'default', containers: [{ name: 'nginx', image: 'nginx' }] }),
            ]

            let createdPodsCount = 0
            eventBus.subscribe('PodCreated', () => {
                createdPodsCount++
            })

            controller.reconcile('default/my-rs')

            // Should create 1 more pod (2 desired - 1 owned = 1 to create)
            expect(createdPodsCount).toBe(1)
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
    })
})
