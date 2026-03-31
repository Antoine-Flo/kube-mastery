import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../src/core/api/ApiServerFacade'
import { createPersistentVolumeClaim } from '../../../src/core/cluster/ressources/PersistentVolumeClaim'
import { createStorageClass } from '../../../src/core/cluster/ressources/StorageClass'
import { createVolumeProvisioningController } from '../../../src/core/volumes/VolumeProvisioningController'

describe('VolumeProvisioningController', () => {
  it('assigns default storage class and creates a dynamic persistent volume', () => {
    const apiServer = createApiServerFacade()
    const controller = createVolumeProvisioningController(apiServer)
    apiServer.createResource(
      'StorageClass',
      createStorageClass({
        name: 'standard',
        spec: {
          provisioner: 'sim.kubemastery.io/hostpath',
          reclaimPolicy: 'Delete',
          volumeBindingMode: 'Immediate'
        },
        annotations: {
          'storageclass.kubernetes.io/is-default-class': 'true'
        }
      })
    )
    apiServer.createResource(
      'PersistentVolumeClaim',
      createPersistentVolumeClaim({
        name: 'dynamic-pvc',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '100Mi' } }
        }
      })
    )

    controller.start()

    const pvcResult = apiServer.findResource(
      'PersistentVolumeClaim',
      'dynamic-pvc',
      'default'
    )
    expect(pvcResult.ok).toBe(true)
    if (!pvcResult.ok) {
      controller.stop()
      return
    }
    expect(pvcResult.value.spec.storageClassName).toBe('standard')

    const generatedPvName = 'pvc-default-dynamic-pvc'
    const pvResult = apiServer.findResource('PersistentVolume', generatedPvName)
    expect(pvResult.ok).toBe(true)
    if (!pvResult.ok) {
      controller.stop()
      return
    }
    expect(pvResult.value.spec.storageClassName).toBe('standard')
    expect(pvResult.value.spec.persistentVolumeReclaimPolicy).toBe('Delete')
    expect(pvResult.value.spec.hostPath?.path).toBe(
      '/sim/dynamic-pv/pvc-default-dynamic-pvc'
    )

    controller.stop()
  })
})
