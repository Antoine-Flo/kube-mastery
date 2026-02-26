import { describe, expect, it } from 'vitest'
import { createClusterState } from '../../../../src/core/cluster/ClusterState'
import { createEventBus } from '../../../../src/core/cluster/events/EventBus'
import {
  createFileSystem,
  type FileSystem
} from '../../../../src/core/filesystem/FileSystem'
import { createHostFileSystem } from '../../../../src/core/filesystem/debianFileSystem'
import { createKubectlExecutor } from '../../../../src/core/kubectl/commands/executor'
import { initializeSimVolumeRuntime } from '../../../../src/core/volumes/SimVolumeRuntime'
import { createLogger } from '../../../../src/logger/Logger'

const PV_YAML = [
  'apiVersion: v1',
  'kind: PersistentVolume',
  'metadata:',
  '  name: pv-fast',
  'spec:',
  '  capacity:',
  '    storage: 10Gi',
  '  accessModes:',
  '    - ReadWriteOnce',
  '  storageClassName: fast',
  '  hostPath:',
  '    path: /tmp/pv-fast'
].join('\n')

const PVC_YAML = [
  'apiVersion: v1',
  'kind: PersistentVolumeClaim',
  'metadata:',
  '  name: data',
  '  namespace: default',
  'spec:',
  '  accessModes:',
  '    - ReadWriteOnce',
  '  resources:',
  '    requests:',
  '      storage: 1Gi',
  '  storageClassName: fast'
].join('\n')

describe('kubectl PV/PVC support', () => {
  it('supports apply/get/describe/delete for pv and pvc', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus)
    const logger = createLogger()
    const fileSystem: FileSystem = createFileSystem(createHostFileSystem())
    const volumeRuntime = initializeSimVolumeRuntime(eventBus, clusterState)
    fileSystem.writeFile('/home/kube/pv.yaml', PV_YAML)
    fileSystem.writeFile('/home/kube/pvc.yaml', PVC_YAML)

    const executor = createKubectlExecutor(clusterState, fileSystem, logger, eventBus)

    const applyPv = executor.execute('kubectl apply -f /home/kube/pv.yaml')
    expect(applyPv.ok).toBe(true)
    const applyPvc = executor.execute('kubectl apply -f /home/kube/pvc.yaml')
    expect(applyPvc.ok).toBe(true)

    const getPv = executor.execute('kubectl get pv')
    expect(getPv.ok).toBe(true)
    if (getPv.ok) {
      expect(getPv.value).toContain('pv-fast')
    }

    const getPvc = executor.execute('kubectl get pvc')
    expect(getPvc.ok).toBe(true)
    if (getPvc.ok) {
      expect(getPvc.value).toContain('data')
    }

    const describePvc = executor.execute('kubectl describe pvc data')
    expect(describePvc.ok).toBe(true)
    if (describePvc.ok) {
      expect(describePvc.value).toContain('Status:')
      expect(describePvc.value).toContain('Bound')
    }

    const deletePvc = executor.execute('kubectl delete pvc data')
    expect(deletePvc.ok).toBe(true)
    const deletePv = executor.execute('kubectl delete pv pv-fast')
    expect(deletePv.ok).toBe(true)

    volumeRuntime.volumeBindingController.stop()
    volumeRuntime.podVolumeController.stop()
  })
})
