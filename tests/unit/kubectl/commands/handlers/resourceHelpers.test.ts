import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import {
  applyResourceWithEvents,
  createResourceWithEvents
} from '../../../../../src/core/kubectl/commands/resourceHelpers'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { createConfigMap } from '../../../../../src/core/cluster/ressources/ConfigMap'
import { createSecret } from '../../../../../src/core/cluster/ressources/Secret'
import { createIngress } from '../../../../../src/core/cluster/ressources/Ingress'

describe('resourceHelpers', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>

  beforeEach(() => {
    apiServer = createApiServerFacade()
  })

  describe('applyResourceWithEvents', () => {
    describe('applying pods', () => {
      it('should create pod when it does not exist', () => {
        const pod = createPod({
          name: 'new-pod',
          namespace: 'default',
          containers: [{ name: 'main', image: 'nginx:latest' }]
        })

        const result = applyResourceWithEvents(pod, apiServer)

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('created')
        }
      })

      it('should emit PodCreated event for new pod', () => {
        const subscriber = vi.fn()
        apiServer.eventBus.subscribe('PodCreated', subscriber)

        const pod = createPod({
          name: 'new-pod',
          namespace: 'default',
          containers: [{ name: 'main', image: 'nginx:latest' }]
        })

        applyResourceWithEvents(pod, apiServer)

        expect(subscriber).toHaveBeenCalled()
      })

      it('should update pod when it exists', () => {
        const existingPod = createPod({
          name: 'existing-pod',
          namespace: 'default',
          containers: [{ name: 'main', image: 'nginx:1.0' }]
        })
        apiServer.createResource('Pod', existingPod)

        const updatedPod = createPod({
          name: 'existing-pod',
          namespace: 'default',
          containers: [{ name: 'main', image: 'nginx:2.0' }]
        })

        const result = applyResourceWithEvents(updatedPod, apiServer)

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
        apiServer.createResource('Pod', existingPod)

        const subscriber = vi.fn()
        apiServer.eventBus.subscribe('PodUpdated', subscriber)

        const updatedPod = createPod({
          name: 'existing-pod',
          namespace: 'default',
          containers: [{ name: 'main', image: 'nginx:2.0' }]
        })

        applyResourceWithEvents(updatedPod, apiServer)

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

        const result = applyResourceWithEvents(cm, apiServer)

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('created')
        }
      })

      it('should emit ConfigMapCreated event', () => {
        const subscriber = vi.fn()
        apiServer.eventBus.subscribe('ConfigMapCreated', subscriber)

        const cm = createConfigMap({
          name: 'new-config',
          namespace: 'default',
          data: {}
        })

        applyResourceWithEvents(cm, apiServer)

        expect(subscriber).toHaveBeenCalled()
      })

      it('should update configmap when it exists', () => {
        const existingCm = createConfigMap({
          name: 'existing-config',
          namespace: 'default',
          data: { key: 'old' }
        })
        apiServer.createResource('ConfigMap', existingCm)

        const updatedCm = createConfigMap({
          name: 'existing-config',
          namespace: 'default',
          data: { key: 'new' }
        })

        const result = applyResourceWithEvents(updatedCm, apiServer)

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
        apiServer.createResource('ConfigMap', existingCm)

        const subscriber = vi.fn()
        apiServer.eventBus.subscribe('ConfigMapUpdated', subscriber)

        const updatedCm = createConfigMap({
          name: 'existing-config',
          namespace: 'default',
          data: { new: 'data' }
        })

        applyResourceWithEvents(updatedCm, apiServer)

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

        const result = applyResourceWithEvents(secret, apiServer)

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('created')
        }
      })

      it('should emit SecretCreated event', () => {
        const subscriber = vi.fn()
        apiServer.eventBus.subscribe('SecretCreated', subscriber)

        const secret = createSecret({
          name: 'new-secret',
          namespace: 'default',
          secretType: { type: 'Opaque' },
          data: {}
        })

        applyResourceWithEvents(secret, apiServer)

        expect(subscriber).toHaveBeenCalled()
      })

      it('should update secret when it exists', () => {
        const existingSecret = createSecret({
          name: 'existing-secret',
          namespace: 'default',
          secretType: { type: 'Opaque' },
          data: { key: 'old' }
        })
        apiServer.createResource('Secret', existingSecret)

        const updatedSecret = createSecret({
          name: 'existing-secret',
          namespace: 'default',
          secretType: { type: 'Opaque' },
          data: { key: 'new' }
        })

        const result = applyResourceWithEvents(updatedSecret, apiServer)

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
        apiServer.createResource('Secret', existingSecret)

        const subscriber = vi.fn()
        apiServer.eventBus.subscribe('SecretUpdated', subscriber)

        const updatedSecret = createSecret({
          name: 'existing-secret',
          namespace: 'default',
          secretType: { type: 'Opaque' },
          data: { new: 'data' }
        })

        applyResourceWithEvents(updatedSecret, apiServer)

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

        const result = applyResourceWithEvents(unknownResource, apiServer)

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

        const result = createResourceWithEvents(pod, apiServer)

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('created')
        }
      })

      it('should emit PodCreated event', () => {
        const subscriber = vi.fn()
        apiServer.eventBus.subscribe('PodCreated', subscriber)

        const pod = createPod({
          name: 'new-pod',
          namespace: 'default',
          containers: [{ name: 'main', image: 'nginx:latest' }]
        })

        createResourceWithEvents(pod, apiServer)

        expect(subscriber).toHaveBeenCalled()
      })

      it('should return error if pod already exists', () => {
        const existingPod = createPod({
          name: 'existing-pod',
          namespace: 'default',
          containers: [{ name: 'main', image: 'nginx:latest' }]
        })
        apiServer.createResource('Pod', existingPod)

        const newPod = createPod({
          name: 'existing-pod',
          namespace: 'default',
          containers: [{ name: 'main', image: 'nginx:2.0' }]
        })

        const result = createResourceWithEvents(newPod, apiServer)

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

        const result = createResourceWithEvents(cm, apiServer)

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('created')
        }
      })

      it('should emit ConfigMapCreated event', () => {
        const subscriber = vi.fn()
        apiServer.eventBus.subscribe('ConfigMapCreated', subscriber)

        const cm = createConfigMap({
          name: 'new-config',
          namespace: 'default',
          data: {}
        })

        createResourceWithEvents(cm, apiServer)

        expect(subscriber).toHaveBeenCalled()
      })

      it('should return error if configmap already exists', () => {
        const existingCm = createConfigMap({
          name: 'existing-config',
          namespace: 'default',
          data: {}
        })
        apiServer.createResource('ConfigMap', existingCm)

        const newCm = createConfigMap({
          name: 'existing-config',
          namespace: 'default',
          data: { new: 'data' }
        })

        const result = createResourceWithEvents(newCm, apiServer)

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

        const result = createResourceWithEvents(secret, apiServer)

        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain('created')
        }
      })

      it('should emit SecretCreated event', () => {
        const subscriber = vi.fn()
        apiServer.eventBus.subscribe('SecretCreated', subscriber)

        const secret = createSecret({
          name: 'new-secret',
          namespace: 'default',
          secretType: { type: 'Opaque' },
          data: {}
        })

        createResourceWithEvents(secret, apiServer)

        expect(subscriber).toHaveBeenCalled()
      })

      it('should return error if secret already exists', () => {
        const existingSecret = createSecret({
          name: 'existing-secret',
          namespace: 'default',
          secretType: { type: 'Opaque' },
          data: {}
        })
        apiServer.createResource('Secret', existingSecret)

        const newSecret = createSecret({
          name: 'existing-secret',
          namespace: 'default',
          secretType: { type: 'Opaque' },
          data: { new: 'data' }
        })

        const result = createResourceWithEvents(newSecret, apiServer)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain('AlreadyExists')
        }
      })
    })

    describe('creating ingresses', () => {
      it('should create ingress with networking reference', () => {
        const ingress = createIngress({
          name: 'demo-ingress',
          namespace: 'default',
          spec: {
            rules: [
              {
                host: 'demo.example.com',
                http: {
                  paths: [
                    {
                      path: '/',
                      pathType: 'Prefix',
                      backend: {
                        service: {
                          name: 'frontend-service',
                          port: { number: 80 }
                        }
                      }
                    }
                  ]
                }
              }
            ]
          }
        })

        const result = createResourceWithEvents(ingress, apiServer)
        expect(result.ok).toBe(true)
        if (result.ok) {
          expect(result.value).toContain(
            'ingress.networking.k8s.io/demo-ingress created'
          )
        }
      })
    })

    describe('unsupported resource types', () => {
      it('should return error for unknown resource type', () => {
        const unknownResource = {
          apiVersion: 'batch/v1',
          kind: 'CronJob',
          metadata: { name: 'test', namespace: 'default' }
        } as any

        const result = createResourceWithEvents(unknownResource, apiServer)

        expect(result.ok).toBe(false)
        if (!result.ok) {
          expect(result.error).toContain("doesn't have a resource type")
        }
      })
    })
  })
})
