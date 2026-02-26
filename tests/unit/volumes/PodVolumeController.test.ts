import { describe, expect, it } from 'vitest'
import { createClusterState } from '../../../src/core/cluster/ClusterState'
import { createEventBus } from '../../../src/core/cluster/events/EventBus'
import { createPersistentVolume } from '../../../src/core/cluster/ressources/PersistentVolume'
import { createPersistentVolumeClaim } from '../../../src/core/cluster/ressources/PersistentVolumeClaim'
import { createPod } from '../../../src/core/cluster/ressources/Pod'
import { initializeSimVolumeRuntime } from '../../../src/core/volumes/SimVolumeRuntime'

describe('PodVolumeController', () => {
  it('marks pod volumes not ready when claim is missing', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus)
    const runtime = initializeSimVolumeRuntime(eventBus, clusterState)

    clusterState.addPod(
      createPod({
        name: 'app',
        namespace: 'default',
        nodeName: 'node-a',
        phase: 'Pending',
        containers: [{ name: 'app', image: 'nginx:latest' }],
        volumes: [
          {
            name: 'data',
            source: {
              type: 'persistentVolumeClaim',
              claimName: 'data-claim'
            }
          }
        ]
      })
    )

    const readiness = runtime.state.getPodReadiness('default', 'app')
    expect(readiness).toEqual({
      ready: false,
      reason: 'PersistentVolumeClaimNotFound'
    })

    runtime.volumeBindingController.stop()
    runtime.podVolumeController.stop()
  })

  it('marks pod volumes ready once claim is bound', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus)
    const runtime = initializeSimVolumeRuntime(eventBus, clusterState)

    clusterState.addPersistentVolume(
      createPersistentVolume({
        name: 'pv-data',
        spec: {
          capacity: { storage: '10Gi' },
          accessModes: ['ReadWriteOnce'],
          storageClassName: 'fast',
          hostPath: { path: '/tmp/pv-data' }
        }
      })
    )
    clusterState.addPersistentVolumeClaim(
      createPersistentVolumeClaim({
        name: 'data-claim',
        namespace: 'default',
        spec: {
          accessModes: ['ReadWriteOnce'],
          resources: { requests: { storage: '1Gi' } },
          storageClassName: 'fast'
        }
      })
    )
    clusterState.addPod(
      createPod({
        name: 'app',
        namespace: 'default',
        nodeName: 'node-a',
        phase: 'Pending',
        containers: [{ name: 'app', image: 'nginx:latest' }],
        volumes: [
          {
            name: 'data',
            source: {
              type: 'persistentVolumeClaim',
              claimName: 'data-claim'
            }
          }
        ]
      })
    )

    const readiness = runtime.state.getPodReadiness('default', 'app')
    expect(readiness).toEqual({ ready: true })

    runtime.volumeBindingController.stop()
    runtime.podVolumeController.stop()
  })
})
