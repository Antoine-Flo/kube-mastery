import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../src/core/api/ApiServerFacade'
import { createPodCreatedEvent } from '../../../src/core/cluster/events/types'
import { createNode } from '../../../src/core/cluster/ressources/Node'
import { createNamespace } from '../../../src/core/cluster/ressources/Namespace'
import { createPersistentVolumeClaim } from '../../../src/core/cluster/ressources/PersistentVolumeClaim'
import { createPod } from '../../../src/core/cluster/ressources/Pod'

describe('ApiServerFacade', () => {
  it('delegates resource version to etcd-like revision', () => {
    const apiServer = createApiServerFacade()
    expect(apiServer.getResourceVersion()).toBe('1')

    apiServer.createResource(
      'Pod',
      createPod({
        name: 'api-pod',
        namespace: 'default',
        containers: [{ name: 'api', image: 'nginx:latest' }]
      })
    )
    expect(apiServer.getResourceVersion()).toBe('2')

    apiServer.stop()
  })

  it('is safe to stop more than once', () => {
    const apiServer = createApiServerFacade()
    apiServer.stop()
    apiServer.stop()
    expect(apiServer.getResourceVersion()).toBe('1')
  })

  it('routes emitted events through etcd-like store', () => {
    const apiServer = createApiServerFacade()
    const pod = createPod({
      name: 'emit-api-pod',
      namespace: 'default',
      containers: [{ name: 'api', image: 'nginx:latest' }]
    })

    apiServer.emitEvent(createPodCreatedEvent(pod, 'api-server-test'))

    expect(apiServer.getResourceVersion()).toBe('2')
    expect(apiServer.etcd.getEventLog().at(-1)?.event.type).toBe('PodCreated')
    expect(apiServer.etcd.getEventLog().at(-1)?.resourceVersion).toBe('2')
    expect(apiServer.etcd.getEventLog().at(-1)?.source).toBe('api-server-test')

    apiServer.stop()
  })

  it('writes node mutations through etcd-backed events', () => {
    const apiServer = createApiServerFacade()
    const node = createNode({
      name: 'worker-a',
      status: {
        nodeInfo: {
          architecture: 'amd64',
          containerRuntimeVersion: 'containerd://2.2.0',
          kernelVersion: '6.18.9-200.fc43.x86_64',
          kubeletVersion: 'v1.35.0',
          operatingSystem: 'linux',
          osImage: 'Debian GNU/Linux 12 (bookworm)'
        }
      }
    })

    expect(apiServer.getResourceVersion()).toBe('1')
    const createResult = apiServer.createResource('Node', node)
    expect(createResult.ok).toBe(true)
    expect(apiServer.getResourceVersion()).toBe('2')
    expect(apiServer.etcd.getEventLog().at(-1)?.event.type).toBe('NodeCreated')

    const updatedNode = {
      ...node,
      metadata: {
        ...node.metadata,
        labels: {
          'kubernetes.io/hostname': 'worker-a'
        }
      }
    }
    const updateResult = apiServer.updateResource(
      'Node',
      'worker-a',
      updatedNode
    )
    expect(updateResult.ok).toBe(true)
    expect(apiServer.getResourceVersion()).toBe('3')
    expect(apiServer.etcd.getEventLog().at(-1)?.event.type).toBe('NodeUpdated')

    const deleteResult = apiServer.deleteResource('Node', 'worker-a')
    expect(deleteResult.ok).toBe(true)
    expect(apiServer.getResourceVersion()).toBe('4')
    expect(apiServer.etcd.getEventLog().at(-1)?.event.type).toBe('NodeDeleted')

    apiServer.stop()
  })

  it('applies bootstrap via api write path', () => {
    const apiServer = createApiServerFacade({
      bootstrap: {
        profile: 'kind-like',
        mode: 'missing-only',
        clusterName: 'conformance',
        clock: () => '2026-03-13T12:00:00.000Z'
      }
    })

    const nodes = apiServer.listResources('Node')
    const namespaces = apiServer.listResources('Namespace')
    const services = apiServer.listResources('Service')
    expect(nodes.length).toBeGreaterThanOrEqual(3)
    expect(
      namespaces.some((item) => item.metadata.name === 'kube-system')
    ).toBe(true)
    expect(services.some((item) => item.metadata.name === 'kubernetes')).toBe(
      true
    )
    expect(Number(apiServer.getResourceVersion())).toBeGreaterThan(1)

    apiServer.stop()
  })

  it('resets pod runtime state when pod image is updated', () => {
    const apiServer = createApiServerFacade()
    const pod = createPod({
      name: 'runtime-reset',
      namespace: 'default',
      phase: 'Running',
      containers: [{ name: 'web', image: 'nginx:1.25' }]
    })
    apiServer.createResource('Pod', pod, 'default')

    const updatedPod = {
      ...pod,
      spec: {
        ...pod.spec,
        containers: [
          { name: 'web', image: 'invalid-registry.local/web:latest' }
        ]
      }
    }
    const updateResult = apiServer.updateResource(
      'Pod',
      'runtime-reset',
      updatedPod,
      'default'
    )
    expect(updateResult.ok).toBe(true)
    if (!updateResult.ok) {
      return
    }
    expect(updateResult.value.status.phase).toBe('Pending')
    expect(
      updateResult.value.status.containerStatuses?.[0]?.stateDetails?.state
    ).toBe('Waiting')
    expect(
      updateResult.value.status.containerStatuses?.[0]?.stateDetails?.reason
    ).toBe('ContainerCreating')
    expect(updateResult.value.status.containerStatuses?.[0]?.image).toBe(
      'invalid-registry.local/web:latest'
    )
    expect(updateResult.value.status.containerStatuses?.[0]?.imageID).toContain(
      'invalid-registry.local/web@sha256:'
    )
  })

  it('assigns default storage class when creating pvc', () => {
    const apiServer = createApiServerFacade({
      bootstrap: {
        profile: 'kind-like',
        mode: 'missing-only',
        clusterName: 'conformance',
        clock: () => '2026-03-13T12:00:00.000Z'
      }
    })
    const persistentVolumeClaim = createPersistentVolumeClaim({
      name: 'dynamic-pvc',
      namespace: 'default',
      spec: {
        accessModes: ['ReadWriteOnce'],
        resources: {
          requests: {
            storage: '100Mi'
          }
        }
      }
    })

    const createResult = apiServer.createResource(
      'PersistentVolumeClaim',
      persistentVolumeClaim,
      'default'
    )

    expect(createResult.ok).toBe(true)
    if (!createResult.ok) {
      return
    }
    expect(createResult.value.spec.storageClassName).toBe('standard')
    apiServer.stop()
  })

  it('publishes kube-root-ca configmap for newly created namespace', () => {
    const apiServer = createApiServerFacade()
    const createNamespaceResult = apiServer.createResource(
      'Namespace',
      createNamespace({ name: 'parity-e2e' })
    )
    expect(createNamespaceResult.ok).toBe(true)
    const rootCaConfigMapResult = apiServer.findResource(
      'ConfigMap',
      'kube-root-ca.crt',
      'parity-e2e'
    )
    expect(rootCaConfigMapResult.ok).toBe(true)
    if (!rootCaConfigMapResult.ok) {
      apiServer.stop()
      return
    }
    expect(rootCaConfigMapResult.value.data?.['ca.crt']).toContain(
      'BEGIN CERTIFICATE'
    )
    apiServer.stop()
  })
})
