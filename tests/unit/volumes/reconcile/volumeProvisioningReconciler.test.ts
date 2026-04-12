import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../src/core/api/ApiServerFacade'
import { createPersistentVolumeClaim } from '../../../../src/core/cluster/ressources/PersistentVolumeClaim'
import { createPod } from '../../../../src/core/cluster/ressources/Pod'
import { createStorageClass } from '../../../../src/core/cluster/ressources/StorageClass'
import { createVolumeBindingPolicy } from '../../../../src/core/volumes/VolumeBindingPolicy'
import {
  makeProvisioningClaimKey,
  reconcileProvisioningClaimByKey
} from '../../../../src/core/volumes/reconcile/volumeProvisioningReconciler'

describe('volumeProvisioningReconciler', () => {
  it('returns FailedBinding when no storage class can be resolved', () => {
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'PersistentVolumeClaim',
      createPersistentVolumeClaim({
        name: 'claim-a',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '1Gi' } }
        }
      })
    )

    const result = reconcileProvisioningClaimByKey(
      makeProvisioningClaimKey('default', 'claim-a'),
      {
        apiServer,
        bindingPolicy: createVolumeBindingPolicy()
      }
    )

    expect(result.reason).toBe('FailedBinding')
  })

  it('returns WaitForFirstConsumer before consumer pod exists', () => {
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'StorageClass',
      createStorageClass({
        name: 'wffc',
        spec: {
          provisioner: 'rancher.io/local-path',
          reclaimPolicy: 'Delete',
          volumeBindingMode: 'WaitForFirstConsumer'
        }
      })
    )
    apiServer.createResource(
      'PersistentVolumeClaim',
      createPersistentVolumeClaim({
        name: 'claim-b',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          storageClassName: 'wffc',
          resources: { requests: { storage: '1Gi' } }
        }
      })
    )

    const result = reconcileProvisioningClaimByKey(
      makeProvisioningClaimKey('default', 'claim-b'),
      {
        apiServer,
        bindingPolicy: createVolumeBindingPolicy()
      }
    )

    expect(result.reason).toBe('WaitForFirstConsumer')
  })

  it('returns ProvisioningSucceeded when dynamic volume is created', () => {
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'StorageClass',
      createStorageClass({
        name: 'wffc',
        spec: {
          provisioner: 'rancher.io/local-path',
          reclaimPolicy: 'Delete',
          volumeBindingMode: 'WaitForFirstConsumer'
        }
      })
    )
    apiServer.createResource(
      'PersistentVolumeClaim',
      createPersistentVolumeClaim({
        name: 'claim-c',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          storageClassName: 'wffc',
          resources: { requests: { storage: '1Gi' } }
        }
      })
    )
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'consumer',
        namespace: 'default',
        nodeName: 'worker-1',
        containers: [{ name: 'app', image: 'busybox:1.36' }],
        volumes: [
          {
            name: 'data',
            source: { type: 'persistentVolumeClaim', claimName: 'claim-c' }
          }
        ]
      })
    )

    const result = reconcileProvisioningClaimByKey(
      makeProvisioningClaimKey('default', 'claim-c'),
      {
        apiServer,
        bindingPolicy: createVolumeBindingPolicy()
      }
    )

    expect(result.reason).toBe('ProvisioningSucceeded')
    const generatedPv = apiServer.findResource(
      'PersistentVolume',
      'pvc-default-claim-c'
    )
    expect(generatedPv.ok).toBe(true)
  })
})
