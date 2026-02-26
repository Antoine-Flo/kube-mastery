import { describe, expect, it } from 'vitest'
import { createPersistentVolume } from '../../../src/core/cluster/ressources/PersistentVolume'
import { createPersistentVolumeClaim } from '../../../src/core/cluster/ressources/PersistentVolumeClaim'
import { createVolumeBindingPolicy } from '../../../src/core/volumes/VolumeBindingPolicy'

describe('VolumeBindingPolicy', () => {
  it('parses binary storage units', () => {
    const policy = createVolumeBindingPolicy()
    expect(policy.parseStorageToBytes('1Gi')).toBe(1024 ** 3)
    expect(policy.parseStorageToBytes('128Mi')).toBe(128 * 1024 ** 2)
  })

  it('finds candidate volume only when constraints match', () => {
    const policy = createVolumeBindingPolicy()
    const matchingPersistentVolume = createPersistentVolume({
      name: 'pv-fast',
      spec: {
        capacity: { storage: '10Gi' },
        accessModes: ['ReadWriteOnce'],
        storageClassName: 'fast',
        hostPath: { path: '/tmp/pv-fast' }
      }
    })
    const wrongClassPersistentVolume = createPersistentVolume({
      name: 'pv-slow',
      spec: {
        capacity: { storage: '10Gi' },
        accessModes: ['ReadWriteOnce'],
        storageClassName: 'slow',
        hostPath: { path: '/tmp/pv-slow' }
      }
    })
    const persistentVolumeClaim = createPersistentVolumeClaim({
      name: 'data',
      namespace: 'default',
      spec: {
        accessModes: ['ReadWriteOnce'],
        resources: { requests: { storage: '1Gi' } },
        storageClassName: 'fast'
      }
    })

    const candidateVolume = policy.findCandidateVolume(
      [wrongClassPersistentVolume, matchingPersistentVolume],
      persistentVolumeClaim
    )

    expect(candidateVolume?.metadata.name).toBe('pv-fast')
  })

  it('does not select already bound volume', () => {
    const policy = createVolumeBindingPolicy()
    const boundPersistentVolume = createPersistentVolume({
      name: 'pv-bound',
      spec: {
        capacity: { storage: '10Gi' },
        accessModes: ['ReadWriteOnce'],
        storageClassName: 'fast',
        hostPath: { path: '/tmp/pv-bound' },
        claimRef: {
          namespace: 'default',
          name: 'other-claim'
        }
      }
    })
    const persistentVolumeClaim = createPersistentVolumeClaim({
      name: 'data',
      namespace: 'default',
      spec: {
        accessModes: ['ReadWriteOnce'],
        resources: { requests: { storage: '1Gi' } },
        storageClassName: 'fast'
      }
    })

    const candidateVolume = policy.findCandidateVolume(
      [boundPersistentVolume],
      persistentVolumeClaim
    )

    expect(candidateVolume).toBeUndefined()
  })
})
