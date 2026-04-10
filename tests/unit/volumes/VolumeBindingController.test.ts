import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../src/core/api/ApiServerFacade'
import { createPod } from '../../../src/core/cluster/ressources/Pod'
import { createPersistentVolume } from '../../../src/core/cluster/ressources/PersistentVolume'
import { createPersistentVolumeClaim } from '../../../src/core/cluster/ressources/PersistentVolumeClaim'
import { createStorageClass } from '../../../src/core/cluster/ressources/StorageClass'
import { createVolumeBindingController } from '../../../src/core/volumes/VolumeBindingController'
import { createVolumeState } from '../../../src/core/volumes/VolumeState'
import { getPersistentVolumeBackingStore } from '../../../src/core/volumes/runtime'

const settleReconciliation = async (): Promise<void> => {
  for (let index = 0; index < 6; index++) {
    await new Promise((resolve) => {
      setTimeout(resolve, 0)
    })
  }
}

describe('VolumeBindingController', () => {
  it('binds available persistent volume to claim', async () => {
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
    await settleReconciliation()

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

  it('keeps claim pending when no matching volume is available', async () => {
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
    await settleReconciliation()

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

  it('does not bind multiple claims to the same volume in one reconcile', async () => {
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
    await settleReconciliation()

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

  it('resets pre-bound claim when referenced volume is missing', async () => {
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
    await settleReconciliation()

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

  it(
    'keeps pre-bound claim pending when volume is already bound to another claim',
    async () => {
    const apiServer = createApiServerFacade()
    const volumeState = createVolumeState()
    const controller = createVolumeBindingController(apiServer, volumeState)

    apiServer.createResource(
      'PersistentVolume',
      createPersistentVolume({
        name: 'pv-shared',
        spec: {
          capacity: { storage: '1Gi' },
          accessModes: ['ReadWriteOnce'],
          storageClassName: 'standard',
          claimRef: {
            namespace: 'default',
            name: 'pvc-owner'
          }
        },
        status: {
          phase: 'Bound'
        }
      })
    )
    apiServer.createResource(
      'PersistentVolumeClaim',
      createPersistentVolumeClaim({
        name: 'pvc-owner',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '1Gi' } },
          storageClassName: 'standard',
          volumeName: 'pv-shared'
        },
        status: {
          phase: 'Bound'
        }
      })
    )
    apiServer.createResource(
      'PersistentVolumeClaim',
      createPersistentVolumeClaim({
        name: 'pvc-thief',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '1Gi' } },
          storageClassName: 'standard',
          volumeName: 'pv-shared'
        },
        status: {
          phase: 'Pending'
        }
      })
    )

      controller.start()
      await settleReconciliation()

    const ownerResult = apiServer.findResource(
      'PersistentVolumeClaim',
      'pvc-owner',
      'default'
    )
    const thiefResult = apiServer.findResource(
      'PersistentVolumeClaim',
      'pvc-thief',
      'default'
    )
    const pvResult = apiServer.findResource('PersistentVolume', 'pv-shared')

    expect(ownerResult.ok).toBe(true)
    expect(thiefResult.ok).toBe(true)
    expect(pvResult.ok).toBe(true)
    if (
      !ownerResult.ok ||
      ownerResult.value == null ||
      !thiefResult.ok ||
      thiefResult.value == null ||
      !pvResult.ok ||
      pvResult.value == null
    ) {
      controller.stop()
      return
    }

    expect(ownerResult.value.status.phase).toBe('Bound')
    expect(ownerResult.value.spec.volumeName).toBe('pv-shared')
    expect(thiefResult.value.status.phase).toBe('Pending')
    expect(thiefResult.value.spec.volumeName).toBeUndefined()
    expect(pvResult.value.spec.claimRef).toEqual({
      namespace: 'default',
      name: 'pvc-owner'
    })
    expect(volumeState.getBoundVolumeForClaim('default', 'pvc-owner')).toBe(
      'pv-shared'
    )
    expect(
      volumeState.getBoundVolumeForClaim('default', 'pvc-thief')
    ).toBeUndefined()

    controller.stop()
    }
  )

  it(
    'deletes bound persistent volume when reclaim policy is Delete and claim is removed',
    async () => {
    const apiServer = createApiServerFacade()
    const volumeState = createVolumeState()
    const controller = createVolumeBindingController(apiServer, volumeState)
    const persistentVolume = createPersistentVolume({
      name: 'pv-delete',
      spec: {
        capacity: { storage: '1Gi' },
        accessModes: ['ReadWriteOnce'],
        persistentVolumeReclaimPolicy: 'Delete',
        storageClassName: 'standard',
        claimRef: {
          namespace: 'default',
          name: 'pvc-delete'
        }
      },
      status: {
        phase: 'Bound'
      }
    })
    apiServer.createResource('PersistentVolume', persistentVolume)
    apiServer.createResource(
      'PersistentVolumeClaim',
      createPersistentVolumeClaim({
        name: 'pvc-delete',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '1Gi' } },
          storageClassName: 'standard',
          volumeName: 'pv-delete'
        },
        status: {
          phase: 'Bound'
        }
      })
    )
    const backingStore = getPersistentVolumeBackingStore()
    backingStore.getOrCreate(persistentVolume)

      controller.start()
      await settleReconciliation()
      apiServer.deleteResource('PersistentVolumeClaim', 'pvc-delete', 'default')
      await settleReconciliation()

    const pvResult = apiServer.findResource('PersistentVolume', 'pv-delete')
    expect(pvResult.ok).toBe(false)
    expect(backingStore.get('pv-delete')).toBeUndefined()

    controller.stop()
    }
  )

  it('keeps a wait-for-first-consumer claim bound after consumer is gone', async () => {
    const apiServer = createApiServerFacade()
    const volumeState = createVolumeState()
    const controller = createVolumeBindingController(apiServer, volumeState)

    apiServer.createResource(
      'StorageClass',
      createStorageClass({
        name: 'wffc',
        spec: {
          provisioner: 'sim.kubemastery.io/hostpath',
          reclaimPolicy: 'Delete',
          volumeBindingMode: 'WaitForFirstConsumer'
        }
      })
    )
    apiServer.createResource(
      'PersistentVolume',
      createPersistentVolume({
        name: 'pv-wffc',
        spec: {
          capacity: { storage: '1Gi' },
          accessModes: ['ReadWriteOnce'],
          storageClassName: 'wffc',
          claimRef: {
            namespace: 'default',
            name: 'wffc-data'
          }
        },
        status: {
          phase: 'Bound'
        }
      })
    )
    apiServer.createResource(
      'PersistentVolumeClaim',
      createPersistentVolumeClaim({
        name: 'wffc-data',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '1Gi' } },
          storageClassName: 'wffc',
          volumeName: 'pv-wffc'
        },
        status: {
          phase: 'Bound'
        }
      })
    )

    controller.start()
    await settleReconciliation()

    const pvcResult = apiServer.findResource(
      'PersistentVolumeClaim',
      'wffc-data',
      'default'
    )
    expect(pvcResult.ok).toBe(true)
    if (!pvcResult.ok || pvcResult.value == null) {
      controller.stop()
      return
    }
    expect(pvcResult.value.status.phase).toBe('Bound')
    expect(pvcResult.value.spec.volumeName).toBe('pv-wffc')

    const pvResult = apiServer.findResource('PersistentVolume', 'pv-wffc')
    expect(pvResult.ok).toBe(true)
    if (!pvResult.ok || pvResult.value == null) {
      controller.stop()
      return
    }
    expect(pvResult.value.status.phase).toBe('Bound')
    expect(pvResult.value.spec.claimRef).toEqual({
      namespace: 'default',
      name: 'wffc-data'
    })
    expect(volumeState.getBoundVolumeForClaim('default', 'wffc-data')).toBe(
      'pv-wffc'
    )

    controller.stop()
  })

  it('binds wait-for-first-consumer claim only after consumer exists', async () => {
    const apiServer = createApiServerFacade()
    const volumeState = createVolumeState()
    const controller = createVolumeBindingController(apiServer, volumeState)

    apiServer.createResource(
      'StorageClass',
      createStorageClass({
        name: 'wffc',
        spec: {
          provisioner: 'sim.kubemastery.io/hostpath',
          reclaimPolicy: 'Delete',
          volumeBindingMode: 'WaitForFirstConsumer'
        }
      })
    )
    apiServer.createResource(
      'PersistentVolume',
      createPersistentVolume({
        name: 'pv-wffc',
        spec: {
          capacity: { storage: '1Gi' },
          accessModes: ['ReadWriteOnce'],
          storageClassName: 'wffc'
        }
      })
    )
    apiServer.createResource(
      'PersistentVolumeClaim',
      createPersistentVolumeClaim({
        name: 'wffc-data',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '1Gi' } },
          storageClassName: 'wffc'
        }
      })
    )

    controller.start()
    await settleReconciliation()

    const pendingResult = apiServer.findResource(
      'PersistentVolumeClaim',
      'wffc-data',
      'default'
    )
    expect(pendingResult.ok).toBe(true)
    if (!pendingResult.ok || pendingResult.value == null) {
      controller.stop()
      return
    }
    expect(pendingResult.value.status.phase).toBe('Pending')
    expect(pendingResult.value.spec.volumeName).toBeUndefined()

    apiServer.createResource(
      'Pod',
      createPod({
        name: 'consumer',
        namespace: 'default',
        nodeName: 'worker-1',
        containers: [{ name: 'main', image: 'busybox:1.36' }],
        volumes: [
          {
            name: 'storage',
            source: {
              type: 'persistentVolumeClaim',
              claimName: 'wffc-data'
            }
          }
        ]
      })
    )
    controller.resyncAll()
    await settleReconciliation()

    const boundResult = apiServer.findResource(
      'PersistentVolumeClaim',
      'wffc-data',
      'default'
    )
    expect(boundResult.ok).toBe(true)
    if (!boundResult.ok || boundResult.value == null) {
      controller.stop()
      return
    }
    expect(boundResult.value.status.phase).toBe('Bound')
    expect(boundResult.value.spec.volumeName).toBe('pv-wffc')
    expect(volumeState.getBoundVolumeForClaim('default', 'wffc-data')).toBe(
      'pv-wffc'
    )

    controller.stop()
  })

  it('keeps reconciliation idempotent across repeated resync', async () => {
    const apiServer = createApiServerFacade()
    const volumeState = createVolumeState()
    const controller = createVolumeBindingController(apiServer, volumeState)

    apiServer.createResource(
      'PersistentVolume',
      createPersistentVolume({
        name: 'pv-idempotent',
        spec: {
          capacity: { storage: '5Gi' },
          accessModes: ['ReadWriteOnce'],
          storageClassName: 'standard'
        }
      })
    )
    apiServer.createResource(
      'PersistentVolumeClaim',
      createPersistentVolumeClaim({
        name: 'claim-idempotent',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '1Gi' } },
          storageClassName: 'standard'
        }
      })
    )

    controller.start()
    await settleReconciliation()
    controller.resyncAll()
    await settleReconciliation()
    controller.resyncAll()
    await settleReconciliation()

    const pvcResult = apiServer.findResource(
      'PersistentVolumeClaim',
      'claim-idempotent',
      'default'
    )
    const pvResult = apiServer.findResource('PersistentVolume', 'pv-idempotent')
    expect(pvcResult.ok).toBe(true)
    expect(pvResult.ok).toBe(true)
    if (
      !pvcResult.ok ||
      pvcResult.value == null ||
      !pvResult.ok ||
      pvResult.value == null
    ) {
      controller.stop()
      return
    }
    expect(pvcResult.value.status.phase).toBe('Bound')
    expect(pvcResult.value.spec.volumeName).toBe('pv-idempotent')
    expect(pvResult.value.spec.claimRef).toEqual({
      namespace: 'default',
      name: 'claim-idempotent'
    })

    controller.stop()
  })

  it('binds claim when matching volume is created later', async () => {
    const apiServer = createApiServerFacade()
    const volumeState = createVolumeState()
    const controller = createVolumeBindingController(apiServer, volumeState)

    apiServer.createResource(
      'PersistentVolumeClaim',
      createPersistentVolumeClaim({
        name: 'late-bind',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '1Gi' } },
          storageClassName: 'fast'
        }
      })
    )

    controller.start()
    await settleReconciliation()

    const pendingResult = apiServer.findResource(
      'PersistentVolumeClaim',
      'late-bind',
      'default'
    )
    expect(pendingResult.ok).toBe(true)
    if (!pendingResult.ok || pendingResult.value == null) {
      controller.stop()
      return
    }
    expect(pendingResult.value.status.phase).toBe('Pending')

    apiServer.createResource(
      'PersistentVolume',
      createPersistentVolume({
        name: 'pv-late',
        spec: {
          capacity: { storage: '2Gi' },
          accessModes: ['ReadWriteOnce'],
          storageClassName: 'fast'
        }
      })
    )
    await settleReconciliation()

    const boundResult = apiServer.findResource(
      'PersistentVolumeClaim',
      'late-bind',
      'default'
    )
    expect(boundResult.ok).toBe(true)
    if (!boundResult.ok || boundResult.value == null) {
      controller.stop()
      return
    }
    expect(boundResult.value.status.phase).toBe('Bound')
    expect(boundResult.value.spec.volumeName).toBe('pv-late')

    controller.stop()
  })
})
