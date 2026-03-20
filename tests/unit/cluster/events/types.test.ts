import { describe, expect, it } from 'vitest'
import {
  createPodCreatedEvent,
  createPodDeletedEvent,
  createPodUpdatedEvent,
  createConfigMapCreatedEvent,
  createConfigMapDeletedEvent,
  createConfigMapUpdatedEvent,
  createSecretCreatedEvent,
  createSecretDeletedEvent,
  createSecretUpdatedEvent,
  createPodLabeledEvent,
  createConfigMapLabeledEvent,
  createSecretLabeledEvent,
  createPodAnnotatedEvent,
  createConfigMapAnnotatedEvent,
  createSecretAnnotatedEvent,
  createLeaseCreatedEvent,
  createLeaseDeletedEvent,
  createLeaseUpdatedEvent
} from '../../../../src/core/cluster/events/types'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'
import { createConfigMap } from '../../../../src/core/cluster/ressources/ConfigMap'
import { createSecret } from '../../../../src/core/cluster/ressources/Secret'
import { createLease } from '../../../../src/core/cluster/ressources/Lease'

describe('Event Types', () => {
  const testPod = createPod({
    name: 'test-pod',
    namespace: 'default',
    containers: [{ name: 'main', image: 'nginx:latest' }]
  })

  const testConfigMap = createConfigMap({
    name: 'test-config',
    namespace: 'default',
    data: { key: 'value' }
  })

  const testSecret = createSecret({
    name: 'test-secret',
    namespace: 'default',
    secretType: { type: 'Opaque' },
    data: { password: 'secret' }
  })

  const testLease = createLease({
    name: 'node-lease-1',
    namespace: 'kube-node-lease',
    spec: {
      holderIdentity: 'node-1',
      leaseDurationSeconds: 40,
      renewTime: new Date().toISOString()
    }
  })

  describe('Pod events', () => {
    it('should create PodCreated event', () => {
      const event = createPodCreatedEvent(testPod)

      expect(event.type).toBe('PodCreated')
      expect(event.payload.pod).toEqual(testPod)
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(event.metadata?.correlationId).toBeTruthy()
    })

    it('should create PodCreated event with source', () => {
      const event = createPodCreatedEvent(testPod, 'kubectl')

      expect(event.metadata?.source).toBe('kubectl')
    })

    it('should create PodDeleted event', () => {
      const event = createPodDeletedEvent('test-pod', 'default', testPod)

      expect(event.type).toBe('PodDeleted')
      expect(event.payload.name).toBe('test-pod')
      expect(event.payload.namespace).toBe('default')
      expect(event.payload.deletedPod).toEqual(testPod)
    })

    it('should create PodUpdated event', () => {
      const updatedPod = createPod({
        name: 'test-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:1.28' }]
      })

      const event = createPodUpdatedEvent(
        'test-pod',
        'default',
        updatedPod,
        testPod
      )

      expect(event.type).toBe('PodUpdated')
      expect(event.payload.name).toBe('test-pod')
      expect(event.payload.pod).toEqual(updatedPod)
      expect(event.payload.previousPod).toEqual(testPod)
    })

    it('should create PodLabeled event', () => {
      const labeledPod = createPod({
        name: 'test-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        labels: { app: 'web' }
      })

      const event = createPodLabeledEvent(
        'test-pod',
        'default',
        { app: 'web' },
        labeledPod,
        testPod
      )

      expect(event.type).toBe('PodLabeled')
      expect(event.payload.labels).toEqual({ app: 'web' })
    })

    it('should create PodAnnotated event', () => {
      const annotatedPod = createPod({
        name: 'test-pod',
        namespace: 'default',
        containers: [{ name: 'main', image: 'nginx:latest' }],
        annotations: { note: 'important' }
      })

      const event = createPodAnnotatedEvent(
        'test-pod',
        'default',
        { note: 'important' },
        annotatedPod,
        testPod
      )

      expect(event.type).toBe('PodAnnotated')
      expect(event.payload.annotations).toEqual({ note: 'important' })
    })
  })

  describe('ConfigMap events', () => {
    it('should create ConfigMapCreated event', () => {
      const event = createConfigMapCreatedEvent(testConfigMap)

      expect(event.type).toBe('ConfigMapCreated')
      expect(event.payload.configMap).toEqual(testConfigMap)
    })

    it('should create ConfigMapDeleted event', () => {
      const event = createConfigMapDeletedEvent(
        'test-config',
        'default',
        testConfigMap
      )

      expect(event.type).toBe('ConfigMapDeleted')
      expect(event.payload.name).toBe('test-config')
      expect(event.payload.deletedConfigMap).toEqual(testConfigMap)
    })

    it('should create ConfigMapUpdated event', () => {
      const updatedConfigMap = createConfigMap({
        name: 'test-config',
        namespace: 'default',
        data: { key: 'new-value' }
      })

      const event = createConfigMapUpdatedEvent(
        'test-config',
        'default',
        updatedConfigMap,
        testConfigMap
      )

      expect(event.type).toBe('ConfigMapUpdated')
      expect(event.payload.configMap).toEqual(updatedConfigMap)
      expect(event.payload.previousConfigMap).toEqual(testConfigMap)
    })

    it('should create ConfigMapLabeled event', () => {
      const labeledConfigMap = createConfigMap({
        name: 'test-config',
        namespace: 'default',
        data: { key: 'value' },
        labels: { env: 'prod' }
      })

      const event = createConfigMapLabeledEvent(
        'test-config',
        'default',
        { env: 'prod' },
        labeledConfigMap,
        testConfigMap
      )

      expect(event.type).toBe('ConfigMapLabeled')
      expect(event.payload.labels).toEqual({ env: 'prod' })
    })

    it('should create ConfigMapAnnotated event', () => {
      const annotatedConfigMap = createConfigMap({
        name: 'test-config',
        namespace: 'default',
        data: { key: 'value' },
        annotations: { description: 'test' }
      })

      const event = createConfigMapAnnotatedEvent(
        'test-config',
        'default',
        { description: 'test' },
        annotatedConfigMap,
        testConfigMap
      )

      expect(event.type).toBe('ConfigMapAnnotated')
      expect(event.payload.annotations).toEqual({ description: 'test' })
    })
  })

  describe('Secret events', () => {
    it('should create SecretCreated event', () => {
      const event = createSecretCreatedEvent(testSecret)

      expect(event.type).toBe('SecretCreated')
      expect(event.payload.secret).toEqual(testSecret)
    })

    it('should create SecretDeleted event', () => {
      const event = createSecretDeletedEvent(
        'test-secret',
        'default',
        testSecret
      )

      expect(event.type).toBe('SecretDeleted')
      expect(event.payload.name).toBe('test-secret')
      expect(event.payload.deletedSecret).toEqual(testSecret)
    })

    it('should create SecretUpdated event', () => {
      const updatedSecret = createSecret({
        name: 'test-secret',
        namespace: 'default',
        secretType: { type: 'Opaque' },
        data: { password: 'new-secret' }
      })

      const event = createSecretUpdatedEvent(
        'test-secret',
        'default',
        updatedSecret,
        testSecret
      )

      expect(event.type).toBe('SecretUpdated')
      expect(event.payload.secret).toEqual(updatedSecret)
      expect(event.payload.previousSecret).toEqual(testSecret)
    })

    it('should create SecretLabeled event', () => {
      const labeledSecret = createSecret({
        name: 'test-secret',
        namespace: 'default',
        secretType: { type: 'Opaque' },
        data: { password: 'secret' },
        labels: { type: 'credentials' }
      })

      const event = createSecretLabeledEvent(
        'test-secret',
        'default',
        { type: 'credentials' },
        labeledSecret,
        testSecret
      )

      expect(event.type).toBe('SecretLabeled')
      expect(event.payload.labels).toEqual({ type: 'credentials' })
    })

    it('should create SecretAnnotated event', () => {
      const annotatedSecret = createSecret({
        name: 'test-secret',
        namespace: 'default',
        secretType: { type: 'Opaque' },
        data: { password: 'secret' },
        annotations: { 'rotation-date': '2024-01-01' }
      })

      const event = createSecretAnnotatedEvent(
        'test-secret',
        'default',
        { 'rotation-date': '2024-01-01' },
        annotatedSecret,
        testSecret
      )

      expect(event.type).toBe('SecretAnnotated')
      expect(event.payload.annotations).toEqual({
        'rotation-date': '2024-01-01'
      })
    })
  })

  describe('Lease events', () => {
    it('should create LeaseCreated event', () => {
      const event = createLeaseCreatedEvent(testLease)

      expect(event.type).toBe('LeaseCreated')
      expect(event.payload.lease).toEqual(testLease)
      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/)
      expect(event.metadata?.correlationId).toBeTruthy()
    })

    it('should create LeaseCreated event with source', () => {
      const event = createLeaseCreatedEvent(testLease, 'kubectl')

      expect(event.metadata?.source).toBe('kubectl')
    })

    it('should create LeaseDeleted event', () => {
      const event = createLeaseDeletedEvent(
        'node-lease-1',
        'kube-node-lease',
        testLease
      )

      expect(event.type).toBe('LeaseDeleted')
      expect(event.payload.name).toBe('node-lease-1')
      expect(event.payload.namespace).toBe('kube-node-lease')
      expect(event.payload.deletedLease).toEqual(testLease)
    })

    it('should create LeaseUpdated event', () => {
      const updatedLease = createLease({
        name: 'node-lease-1',
        namespace: 'kube-node-lease',
        spec: {
          holderIdentity: 'node-1',
          leaseDurationSeconds: 40,
          renewTime: new Date().toISOString()
        }
      })

      const event = createLeaseUpdatedEvent(
        'node-lease-1',
        'kube-node-lease',
        updatedLease,
        testLease
      )

      expect(event.type).toBe('LeaseUpdated')
      expect(event.payload.name).toBe('node-lease-1')
      expect(event.payload.namespace).toBe('kube-node-lease')
      expect(event.payload.lease).toEqual(updatedLease)
      expect(event.payload.previousLease).toEqual(testLease)
    })
  })

  describe('event metadata', () => {
    it('should include timestamp in ISO format', () => {
      const event = createPodCreatedEvent(testPod)

      expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })

    it('should include correlation ID', () => {
      const event = createPodCreatedEvent(testPod)

      expect(event.metadata?.correlationId).toBeTruthy()
      expect(typeof event.metadata?.correlationId).toBe('string')
    })

    it('should default source to cluster', () => {
      const event = createPodCreatedEvent(testPod)

      expect(event.metadata?.source).toBe('cluster')
    })

    it('should use custom source when provided', () => {
      const event = createSecretCreatedEvent(testSecret, 'api-server')

      expect(event.metadata?.source).toBe('api-server')
    })
  })
})
