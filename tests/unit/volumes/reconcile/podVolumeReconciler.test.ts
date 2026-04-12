import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../src/core/api/ApiServerFacade'
import { createPersistentVolume } from '../../../../src/core/cluster/ressources/PersistentVolume'
import { createPersistentVolumeClaim } from '../../../../src/core/cluster/ressources/PersistentVolumeClaim'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'
import { createVolumeState } from '../../../../src/core/volumes/VolumeState'
import {
  makePodVolumeKey,
  reconcilePodVolumeByKey
} from '../../../../src/core/volumes/reconcile/podVolumeReconciler'

describe('podVolumeReconciler', () => {
  it('returns FailedMount when referenced claim is missing', () => {
    const apiServer = createApiServerFacade()
    const volumeState = createVolumeState()
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'app',
        namespace: 'default',
        containers: [{ name: 'app', image: 'busybox:1.36' }],
        volumes: [
          {
            name: 'data',
            source: {
              type: 'persistentVolumeClaim',
              claimName: 'missing-claim'
            }
          }
        ]
      })
    )

    const result = reconcilePodVolumeByKey(makePodVolumeKey('default', 'app'), {
      apiServer,
      volumeState
    })

    expect(result.reason).toBe('FailedMount')
    expect(result.readiness?.ready).toBe(false)
    expect(result.readiness?.reason).toBe('PersistentVolumeClaimNotFound')
  })

  it('returns VolumeReady when claim and volume are bound', () => {
    const apiServer = createApiServerFacade()
    const volumeState = createVolumeState()

    apiServer.createResource(
      'PersistentVolume',
      createPersistentVolume({
        name: 'pv-a',
        spec: {
          capacity: { storage: '1Gi' },
          accessModes: ['ReadWriteOnce'],
          claimRef: { namespace: 'default', name: 'claim-a' }
        }
      })
    )
    apiServer.createResource(
      'PersistentVolumeClaim',
      createPersistentVolumeClaim({
        name: 'claim-a',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          volumeName: 'pv-a',
          resources: { requests: { storage: '1Gi' } }
        }
      })
    )
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'app',
        namespace: 'default',
        containers: [{ name: 'app', image: 'busybox:1.36' }],
        volumes: [
          {
            name: 'data',
            source: { type: 'persistentVolumeClaim', claimName: 'claim-a' }
          }
        ]
      })
    )

    const result = reconcilePodVolumeByKey(makePodVolumeKey('default', 'app'), {
      apiServer,
      volumeState
    })

    expect(result.reason).toBe('VolumeReady')
    expect(result.readiness).toEqual({ ready: true })
  })
})
