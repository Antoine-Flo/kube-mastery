import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../src/core/api/ApiServerFacade'
import { generateTemplateHash } from '../../../../src/core/cluster/ressources/Deployment'
import { createStatefulSet } from '../../../../src/core/cluster/ressources/StatefulSet'
import { StatefulSetController } from '../../../../src/core/control-plane/controllers/StatefulSetController'

describe('StatefulSetController', () => {
  it('creates pods up to desired replicas and updates status', () => {
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'StatefulSet',
      createStatefulSet({
        name: 'db',
        namespace: 'default',
        replicas: 2,
        selector: { matchLabels: { app: 'db' } },
        serviceName: 'db',
        template: {
          metadata: { labels: { app: 'db' } },
          spec: {
            containers: [{ name: 'db', image: 'postgres:16' }]
          }
        }
      })
    )

    const controller = new StatefulSetController(apiServer)
    controller.reconcile('default/db')

    const pods = apiServer.listResources('Pod', 'default')
    expect(pods).toHaveLength(2)
    expect(pods.map((pod) => pod.metadata.name).sort()).toEqual([
      'db-0',
      'db-1'
    ])

    const updatedStatefulSet = apiServer.findResource(
      'StatefulSet',
      'db',
      'default'
    )
    expect(updatedStatefulSet.ok).toBe(true)
    if (!updatedStatefulSet.ok) {
      return
    }
    expect(updatedStatefulSet.value.status.currentReplicas).toBe(2)
    expect(updatedStatefulSet.value.status.updatedReplicas).toBe(2)
  })

  it('replaces outdated pods when template hash changes', () => {
    const apiServer = createApiServerFacade()
    const initial = createStatefulSet({
      name: 'db',
      namespace: 'default',
      replicas: 1,
      selector: { matchLabels: { app: 'db' } },
      serviceName: 'db',
      template: {
        metadata: { labels: { app: 'db' } },
        spec: {
          containers: [{ name: 'db', image: 'postgres:16' }]
        }
      }
    })
    apiServer.createResource('StatefulSet', initial)

    const controller = new StatefulSetController(apiServer)
    controller.reconcile('default/db')

    const nextTemplateHash = generateTemplateHash({
      metadata: {
        labels: { app: 'db' },
        annotations: { restart: '1' }
      },
      spec: {
        containers: [{ name: 'db', image: 'postgres:16' }]
      }
    }).slice(0, 10)

    const beforeUpdate = apiServer.findResource('StatefulSet', 'db', 'default')
    expect(beforeUpdate.ok).toBe(true)
    if (!beforeUpdate.ok) {
      return
    }
    apiServer.updateResource(
      'StatefulSet',
      'db',
      {
        ...beforeUpdate.value,
        spec: {
          ...beforeUpdate.value.spec,
          template: {
            ...beforeUpdate.value.spec.template,
            metadata: {
              ...(beforeUpdate.value.spec.template.metadata ?? {}),
              annotations: { restart: '1' }
            }
          }
        }
      },
      'default'
    )

    controller.reconcile('default/db')

    const pods = apiServer.listResources('Pod', 'default')
    expect(pods).toHaveLength(1)
    expect(pods[0].metadata.name).toBe('db-0')
    expect(pods[0].metadata.annotations?.['controller-revision-hash']).toBe(
      nextTemplateHash
    )
  })
})
