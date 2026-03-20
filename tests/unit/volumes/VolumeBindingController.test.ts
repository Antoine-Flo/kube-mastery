import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../src/core/api/ApiServerFacade'
import { createPersistentVolume } from '../../../src/core/cluster/ressources/PersistentVolume'
import { createPersistentVolumeClaim } from '../../../src/core/cluster/ressources/PersistentVolumeClaim'
import { createVolumeBindingController } from '../../../src/core/volumes/VolumeBindingController'
import { createVolumeState } from '../../../src/core/volumes/VolumeState'

describe('VolumeBindingController', () => {
  it('binds available persistent volume to claim', () => {
    const apiServer = createApiServerFacade()
    const volumeState = createVolumeState()
    const controller = createVolumeBindingController(apiServer, volumeState)

    apiServer.createResource(
      'PersistentVolume',
      createPersistentVolume({
        name: 'pv-fast',
        spec: {
          capacity: { storage: '10Gi' },
          accessModes: ['ReadWriteOnce'],
          storageClassName: 'fast',
          hostPath: { path: '/tmp/pv-fast' }
        }
      })
    )
    apiServer.createResource(
      'PersistentVolumeClaim',
      createPersistentVolumeClaim({
        name: 'data',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '1Gi' } },
          storageClassName: 'fast'
        }
      })
    )

    controller.start()

    const pvcResult = apiServer.findResource(
      'PersistentVolumeClaim',
      'data',
      'default'
    )
    expect(pvcResult.ok).toBe(true)
    if (!pvcResult.ok || pvcResult.value == null) {
      controller.stop()
      return
    }
    expect(pvcResult.value.status.phase).toBe('Bound')
    expect(pvcResult.value.spec.volumeName).toBe('pv-fast')

    const pvResult = apiServer.findResource('PersistentVolume', 'pv-fast')
    expect(pvResult.ok).toBe(true)
    if (!pvResult.ok || pvResult.value == null) {
      controller.stop()
      return
    }
    expect(pvResult.value.status.phase).toBe('Bound')
    expect(pvResult.value.spec.claimRef).toEqual({
      namespace: 'default',
      name: 'data'
    })

    expect(volumeState.getBoundVolumeForClaim('default', 'data')).toBe(
      'pv-fast'
    )
    controller.stop()
  })

  it('keeps claim pending when no matching volume is available', () => {
    const apiServer = createApiServerFacade()
    const volumeState = createVolumeState()
    const controller = createVolumeBindingController(apiServer, volumeState)

    apiServer.createResource(
      'PersistentVolumeClaim',
      createPersistentVolumeClaim({
        name: 'data',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteMany'],
          resources: { requests: { storage: '5Gi' } },
          storageClassName: 'slow'
        }
      })
    )

    controller.start()

    const pvcResult = apiServer.findResource(
      'PersistentVolumeClaim',
      'data',
      'default'
    )
    expect(pvcResult.ok).toBe(true)
    if (!pvcResult.ok || pvcResult.value == null) {
      controller.stop()
      return
    }
    expect(pvcResult.value.status.phase).toBe('Pending')
    expect(pvcResult.value.spec.volumeName).toBeUndefined()
    expect(
      volumeState.getBoundVolumeForClaim('default', 'data')
    ).toBeUndefined()
    controller.stop()
  })

  it('does not bind multiple claims to the same volume in one reconcile', () => {
    const apiServer = createApiServerFacade()
    const volumeState = createVolumeState()
    const controller = createVolumeBindingController(apiServer, volumeState)

    apiServer.createResource(
      'PersistentVolume',
      createPersistentVolume({
        name: 'pv-1',
        spec: {
          capacity: { storage: '1Gi' },
          accessModes: ['ReadWriteOnce'],
          storageClassName: 'standard'
        }
      })
    )

    apiServer.createResource(
      'PersistentVolumeClaim',
      createPersistentVolumeClaim({
        name: 'pvc-1',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '1Gi' } },
          storageClassName: 'standard'
        }
      })
    )

    apiServer.createResource(
      'PersistentVolumeClaim',
      createPersistentVolumeClaim({
        name: 'pvc-2',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '1Gi' } },
          storageClassName: 'standard'
        }
      })
    )

    controller.start()

    const pvc1Result = apiServer.findResource(
      'PersistentVolumeClaim',
      'pvc-1',
      'default'
    )
    const pvc2Result = apiServer.findResource(
      'PersistentVolumeClaim',
      'pvc-2',
      'default'
    )

    expect(pvc1Result.ok).toBe(true)
    expect(pvc2Result.ok).toBe(true)

    if (
      !pvc1Result.ok ||
      pvc1Result.value == null ||
      !pvc2Result.ok ||
      pvc2Result.value == null
    ) {
      controller.stop()
      return
    }

    const claims = [pvc1Result.value, pvc2Result.value]
    const boundClaims = claims.filter((claim) => claim.status.phase === 'Bound')

    expect(boundClaims).toHaveLength(1)
    expect(boundClaims[0].spec.volumeName).toBe('pv-1')

    const pendingClaim = claims.find(
      (claim) => claim.status.phase === 'Pending'
    )
    expect(pendingClaim).toBeDefined()
    expect(pendingClaim?.spec.volumeName).toBeUndefined()

    controller.stop()
  })

  it('resets pre-bound claim when referenced volume is missing', () => {
    const apiServer = createApiServerFacade()
    const volumeState = createVolumeState()
    const controller = createVolumeBindingController(apiServer, volumeState)

    apiServer.createResource(
      'PersistentVolumeClaim',
      createPersistentVolumeClaim({
        name: 'dangling',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '1Gi' } },
          storageClassName: 'standard',
          volumeName: 'missing-pv'
        },
        status: {
          phase: 'Bound'
        }
      })
    )

    controller.start()

    const pvcResult = apiServer.findResource(
      'PersistentVolumeClaim',
      'dangling',
      'default'
    )
    expect(pvcResult.ok).toBe(true)
    if (!pvcResult.ok || pvcResult.value == null) {
      controller.stop()
      return
    }

    expect(pvcResult.value.status.phase).toBe('Pending')
    expect(pvcResult.value.spec.volumeName).toBeUndefined()
    expect(
      volumeState.getBoundVolumeForClaim('default', 'dangling')
    ).toBeUndefined()

    controller.stop()
  })
})
