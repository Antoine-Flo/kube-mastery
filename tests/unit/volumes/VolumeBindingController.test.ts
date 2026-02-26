import { describe, expect, it } from 'vitest'
import { createClusterState } from '../../../src/core/cluster/ClusterState'
import { createEventBus } from '../../../src/core/cluster/events/EventBus'
import { createPersistentVolume } from '../../../src/core/cluster/ressources/PersistentVolume'
import { createPersistentVolumeClaim } from '../../../src/core/cluster/ressources/PersistentVolumeClaim'
import { createVolumeBindingController } from '../../../src/core/volumes/VolumeBindingController'
import { createVolumeState } from '../../../src/core/volumes/VolumeState'

describe('VolumeBindingController', () => {
  it('binds available persistent volume to claim', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus)
    const volumeState = createVolumeState()
    const controller = createVolumeBindingController(
      eventBus,
      clusterState,
      volumeState
    )

    clusterState.addPersistentVolume(
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
    clusterState.addPersistentVolumeClaim(
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

    const pvcResult = clusterState.findPersistentVolumeClaim('data', 'default')
    expect(pvcResult.ok).toBe(true)
    if (!pvcResult.ok || pvcResult.value == null) {
      controller.stop()
      return
    }
    expect(pvcResult.value.status.phase).toBe('Bound')
    expect(pvcResult.value.spec.volumeName).toBe('pv-fast')

    const pvResult = clusterState.findPersistentVolume('pv-fast')
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

    expect(volumeState.getBoundVolumeForClaim('default', 'data')).toBe('pv-fast')
    controller.stop()
  })

  it('keeps claim pending when no matching volume is available', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus)
    const volumeState = createVolumeState()
    const controller = createVolumeBindingController(
      eventBus,
      clusterState,
      volumeState
    )

    clusterState.addPersistentVolumeClaim(
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

    const pvcResult = clusterState.findPersistentVolumeClaim('data', 'default')
    expect(pvcResult.ok).toBe(true)
    if (!pvcResult.ok || pvcResult.value == null) {
      controller.stop()
      return
    }
    expect(pvcResult.value.status.phase).toBe('Pending')
    expect(pvcResult.value.spec.volumeName).toBeUndefined()
    expect(volumeState.getBoundVolumeForClaim('default', 'data')).toBeUndefined()
    controller.stop()
  })
})
