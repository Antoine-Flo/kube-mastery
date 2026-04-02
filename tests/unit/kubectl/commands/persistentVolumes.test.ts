import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../src/core/api/ApiServerFacade'
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

const DYNAMIC_PVC_YAML = [
  'apiVersion: v1',
  'kind: PersistentVolumeClaim',
  'metadata:',
  '  name: dynamic-pvc',
  '  namespace: default',
  'spec:',
  '  accessModes:',
  '    - ReadWriteOnce',
  '  resources:',
  '    requests:',
  '      storage: 100Mi',
  '  storageClassName: standard'
].join('\n')

const STORAGE_CLASS_YAML = [
  'apiVersion: storage.k8s.io/v1',
  'kind: StorageClass',
  'metadata:',
  '  name: standard',
  'provisioner: rancher.io/local-path',
  'reclaimPolicy: Delete',
  'volumeBindingMode: WaitForFirstConsumer'
].join('\n')

const DYNAMIC_POD_YAML = [
  'apiVersion: v1',
  'kind: Pod',
  'metadata:',
  '  name: dynamic-storage-demo',
  '  namespace: default',
  'spec:',
  '  containers:',
  '    - name: app',
  '      image: busybox',
  '      args: ["sleep", "3600"]',
  '      volumeMounts:',
  '        - name: data',
  '          mountPath: /data',
  '  volumes:',
  '    - name: data',
  '      persistentVolumeClaim:',
  '        claimName: dynamic-pvc'
].join('\n')

describe('kubectl PV/PVC support', () => {
  it('supports apply/get/describe/delete for pv and pvc', () => {
    const apiServer = createApiServerFacade()
    const logger = createLogger()
    const fileSystem: FileSystem = createFileSystem(createHostFileSystem())
    const volumeRuntime = initializeSimVolumeRuntime(apiServer)
    fileSystem.writeFile('/home/kube/pv.yaml', PV_YAML)
    fileSystem.writeFile('/home/kube/pvc.yaml', PVC_YAML)

    const executor = createKubectlExecutor(apiServer, fileSystem, logger)

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

  it('keeps WaitForFirstConsumer and provisioning events in describe pvc', () => {
    const apiServer = createApiServerFacade()
    const logger = createLogger()
    const fileSystem: FileSystem = createFileSystem(createHostFileSystem())
    const volumeRuntime = initializeSimVolumeRuntime(apiServer)
    fileSystem.writeFile('/home/kube/storageclass.yaml', STORAGE_CLASS_YAML)
    fileSystem.writeFile('/home/kube/dynamic-pvc.yaml', DYNAMIC_PVC_YAML)
    fileSystem.writeFile('/home/kube/dynamic-pod.yaml', DYNAMIC_POD_YAML)

    const executor = createKubectlExecutor(apiServer, fileSystem, logger)
    const applyStorageClass = executor.execute(
      'kubectl apply -f /home/kube/storageclass.yaml'
    )
    expect(applyStorageClass.ok).toBe(true)

    const applyPvc = executor.execute(
      'kubectl apply -f /home/kube/dynamic-pvc.yaml'
    )
    expect(applyPvc.ok).toBe(true)

    const describePending = executor.execute('kubectl describe pvc dynamic-pvc')
    expect(describePending.ok).toBe(true)
    if (describePending.ok) {
      expect(describePending.value).toContain('WaitForFirstConsumer')
    }

    const applyPod = executor.execute(
      'kubectl apply -f /home/kube/dynamic-pod.yaml'
    )
    expect(applyPod.ok).toBe(true)

    const describeBound = executor.execute('kubectl describe pvc dynamic-pvc')
    expect(describeBound.ok).toBe(true)
    if (describeBound.ok) {
      expect(describeBound.value).toContain('Status:        Bound')
      expect(describeBound.value).toContain('WaitForFirstConsumer')
      expect(describeBound.value).toContain('Provisioning')
      expect(describeBound.value).toContain('ProvisioningSucceeded')
      expect(describeBound.value).toContain('rancher.io/local-path')
    }

    volumeRuntime.volumeProvisioningController.stop()
    volumeRuntime.volumeBindingController.stop()
    volumeRuntime.podVolumeController.stop()
  })
})
