import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
    applyResourceWithEvents,
    createResourceWithEvents
} from '../../../../../src/core/kubectl/commands/handlers/resourceHelpers'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { createConfigMap } from '../../../../../src/core/cluster/ressources/ConfigMap'
import { createSecret } from '../../../../../src/core/cluster/ressources/Secret'
import { createEventBus, type EventBus } from '../../../../../src/core/cluster/events/EventBus'
import { createClusterState, type ClusterState } from '../../../../../src/core/cluster/ClusterState'

describe('resourceHelpers', () => {
    let eventBus: EventBus
    let clusterState: ClusterState

    beforeEach(() => {
        eventBus = createEventBus()
        clusterState = createClusterState(eventBus)
    })

    describe('applyResourceWithEvents', () => {
        describe('applying pods', () => {
            it('should create pod when it does not exist', () => {
                const pod = createPod({
                    name: 'new-pod',
                    namespace: 'default',
                    containers: [{ name: 'main', image: 'nginx:latest' }]
                })

                const result = applyResourceWithEvents(pod, clusterState, eventBus)

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('created')
                }
            })

            it('should emit PodCreated event for new pod', () => {
                const subscriber = vi.fn()
                eventBus.subscribe('PodCreated', subscriber)

                const pod = createPod({
                    name: 'new-pod',
                    namespace: 'default',
                    containers: [{ name: 'main', image: 'nginx:latest' }]
                })

                applyResourceWithEvents(pod, clusterState, eventBus)

                expect(subscriber).toHaveBeenCalled()
            })

            it('should update pod when it exists', () => {
                const existingPod = createPod({
                    name: 'existing-pod',
                    namespace: 'default',
                    containers: [{ name: 'main', image: 'nginx:1.0' }]
                })
                clusterState.addPod(existingPod)

                const updatedPod = createPod({
                    name: 'existing-pod',
                    namespace: 'default',
                    containers: [{ name: 'main', image: 'nginx:2.0' }]
                })

                const result = applyResourceWithEvents(updatedPod, clusterState, eventBus)

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('configured')
                }
            })

            it('should emit PodUpdated event for existing pod', () => {
                const existingPod = createPod({
                    name: 'existing-pod',
                    namespace: 'default',
                    containers: [{ name: 'main', image: 'nginx:latest' }]
                })
                clusterState.addPod(existingPod)

                const subscriber = vi.fn()
                eventBus.subscribe('PodUpdated', subscriber)

                const updatedPod = createPod({
                    name: 'existing-pod',
                    namespace: 'default',
                    containers: [{ name: 'main', image: 'nginx:2.0' }]
                })

                applyResourceWithEvents(updatedPod, clusterState, eventBus)

                expect(subscriber).toHaveBeenCalled()
            })
        })

        describe('applying configmaps', () => {
            it('should create configmap when it does not exist', () => {
                const cm = createConfigMap({
                    name: 'new-config',
                    namespace: 'default',
                    data: { key: 'value' }
                })

                const result = applyResourceWithEvents(cm, clusterState, eventBus)

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('created')
                }
            })

            it('should emit ConfigMapCreated event', () => {
                const subscriber = vi.fn()
                eventBus.subscribe('ConfigMapCreated', subscriber)

                const cm = createConfigMap({
                    name: 'new-config',
                    namespace: 'default',
                    data: {}
                })

                applyResourceWithEvents(cm, clusterState, eventBus)

                expect(subscriber).toHaveBeenCalled()
            })

            it('should update configmap when it exists', () => {
                const existingCm = createConfigMap({
                    name: 'existing-config',
                    namespace: 'default',
                    data: { key: 'old' }
                })
                clusterState.addConfigMap(existingCm)

                const updatedCm = createConfigMap({
                    name: 'existing-config',
                    namespace: 'default',
                    data: { key: 'new' }
                })

                const result = applyResourceWithEvents(updatedCm, clusterState, eventBus)

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('configured')
                }
            })

            it('should emit ConfigMapUpdated event', () => {
                const existingCm = createConfigMap({
                    name: 'existing-config',
                    namespace: 'default',
                    data: {}
                })
                clusterState.addConfigMap(existingCm)

                const subscriber = vi.fn()
                eventBus.subscribe('ConfigMapUpdated', subscriber)

                const updatedCm = createConfigMap({
                    name: 'existing-config',
                    namespace: 'default',
                    data: { new: 'data' }
                })

                applyResourceWithEvents(updatedCm, clusterState, eventBus)

                expect(subscriber).toHaveBeenCalled()
            })
        })

        describe('applying secrets', () => {
            it('should create secret when it does not exist', () => {
                const secret = createSecret({
                    name: 'new-secret',
                    namespace: 'default',
                    secretType: { type: 'Opaque' },
                    data: { password: 'secret' }
                })

                const result = applyResourceWithEvents(secret, clusterState, eventBus)

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('created')
                }
            })

            it('should emit SecretCreated event', () => {
                const subscriber = vi.fn()
                eventBus.subscribe('SecretCreated', subscriber)

                const secret = createSecret({
                    name: 'new-secret',
                    namespace: 'default',
                    secretType: { type: 'Opaque' },
                    data: {}
                })

                applyResourceWithEvents(secret, clusterState, eventBus)

                expect(subscriber).toHaveBeenCalled()
            })

            it('should update secret when it exists', () => {
                const existingSecret = createSecret({
                    name: 'existing-secret',
                    namespace: 'default',
                    secretType: { type: 'Opaque' },
                    data: { key: 'old' }
                })
                clusterState.addSecret(existingSecret)

                const updatedSecret = createSecret({
                    name: 'existing-secret',
                    namespace: 'default',
                    secretType: { type: 'Opaque' },
                    data: { key: 'new' }
                })

                const result = applyResourceWithEvents(updatedSecret, clusterState, eventBus)

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('configured')
                }
            })

            it('should emit SecretUpdated event', () => {
                const existingSecret = createSecret({
                    name: 'existing-secret',
                    namespace: 'default',
                    secretType: { type: 'Opaque' },
                    data: {}
                })
                clusterState.addSecret(existingSecret)

                const subscriber = vi.fn()
                eventBus.subscribe('SecretUpdated', subscriber)

                const updatedSecret = createSecret({
                    name: 'existing-secret',
                    namespace: 'default',
                    secretType: { type: 'Opaque' },
                    data: { new: 'data' }
                })

                applyResourceWithEvents(updatedSecret, clusterState, eventBus)

                expect(subscriber).toHaveBeenCalled()
            })
        })

        describe('unsupported resource types', () => {
            it('should return error for unknown resource type', () => {
                const unknownResource = {
                    apiVersion: 'v1',
                    kind: 'UnknownResource',
                    metadata: { name: 'test', namespace: 'default' }
                } as any

                const result = applyResourceWithEvents(unknownResource, clusterState, eventBus)

                expect(result.ok).toBe(false)
                if (!result.ok) {
                    expect(result.error).toContain("doesn't have a resource type")
                }
            })
        })
    })

    describe('createResourceWithEvents', () => {
        describe('creating pods', () => {
            it('should create new pod', () => {
                const pod = createPod({
                    name: 'new-pod',
                    namespace: 'default',
                    containers: [{ name: 'main', image: 'nginx:latest' }]
                })

                const result = createResourceWithEvents(pod, clusterState, eventBus)

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('created')
                }
            })

            it('should emit PodCreated event', () => {
                const subscriber = vi.fn()
                eventBus.subscribe('PodCreated', subscriber)

                const pod = createPod({
                    name: 'new-pod',
                    namespace: 'default',
                    containers: [{ name: 'main', image: 'nginx:latest' }]
                })

                createResourceWithEvents(pod, clusterState, eventBus)

                expect(subscriber).toHaveBeenCalled()
            })

            it('should return error if pod already exists', () => {
                const existingPod = createPod({
                    name: 'existing-pod',
                    namespace: 'default',
                    containers: [{ name: 'main', image: 'nginx:latest' }]
                })
                clusterState.addPod(existingPod)

                const newPod = createPod({
                    name: 'existing-pod',
                    namespace: 'default',
                    containers: [{ name: 'main', image: 'nginx:2.0' }]
                })

                const result = createResourceWithEvents(newPod, clusterState, eventBus)

                expect(result.ok).toBe(false)
                if (!result.ok) {
                    expect(result.error).toContain('AlreadyExists')
                }
            })
        })

        describe('creating configmaps', () => {
            it('should create new configmap', () => {
                const cm = createConfigMap({
                    name: 'new-config',
                    namespace: 'default',
                    data: { key: 'value' }
                })

                const result = createResourceWithEvents(cm, clusterState, eventBus)

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('created')
                }
            })

            it('should emit ConfigMapCreated event', () => {
                const subscriber = vi.fn()
                eventBus.subscribe('ConfigMapCreated', subscriber)

                const cm = createConfigMap({
                    name: 'new-config',
                    namespace: 'default',
                    data: {}
                })

                createResourceWithEvents(cm, clusterState, eventBus)

                expect(subscriber).toHaveBeenCalled()
            })

            it('should return error if configmap already exists', () => {
                const existingCm = createConfigMap({
                    name: 'existing-config',
                    namespace: 'default',
                    data: {}
                })
                clusterState.addConfigMap(existingCm)

                const newCm = createConfigMap({
                    name: 'existing-config',
                    namespace: 'default',
                    data: { new: 'data' }
                })

                const result = createResourceWithEvents(newCm, clusterState, eventBus)

                expect(result.ok).toBe(false)
                if (!result.ok) {
                    expect(result.error).toContain('AlreadyExists')
                }
            })
        })

        describe('creating secrets', () => {
            it('should create new secret', () => {
                const secret = createSecret({
                    name: 'new-secret',
                    namespace: 'default',
                    secretType: { type: 'Opaque' },
                    data: {}
                })

                const result = createResourceWithEvents(secret, clusterState, eventBus)

                expect(result.ok).toBe(true)
                if (result.ok) {
                    expect(result.value).toContain('created')
                }
            })

            it('should emit SecretCreated event', () => {
                const subscriber = vi.fn()
                eventBus.subscribe('SecretCreated', subscriber)

                const secret = createSecret({
                    name: 'new-secret',
                    namespace: 'default',
                    secretType: { type: 'Opaque' },
                    data: {}
                })

                createResourceWithEvents(secret, clusterState, eventBus)

                expect(subscriber).toHaveBeenCalled()
            })

            it('should return error if secret already exists', () => {
                const existingSecret = createSecret({
                    name: 'existing-secret',
                    namespace: 'default',
                    secretType: { type: 'Opaque' },
                    data: {}
                })
                clusterState.addSecret(existingSecret)

                const newSecret = createSecret({
                    name: 'existing-secret',
                    namespace: 'default',
                    secretType: { type: 'Opaque' },
                    data: { new: 'data' }
                })

                const result = createResourceWithEvents(newSecret, clusterState, eventBus)

                expect(result.ok).toBe(false)
                if (!result.ok) {
                    expect(result.error).toContain('AlreadyExists')
                }
            })
        })

        describe('unsupported resource types', () => {
            it('should return error for unknown resource type', () => {
                const unknownResource = {
                    apiVersion: 'apps/v1',
                    kind: 'StatefulSet',
                    metadata: { name: 'test', namespace: 'default' }
                } as any

                const result = createResourceWithEvents(unknownResource, clusterState, eventBus)

                expect(result.ok).toBe(false)
                if (!result.ok) {
                    expect(result.error).toContain("doesn't have a resource type")
                }
            })
        })
    })
})
