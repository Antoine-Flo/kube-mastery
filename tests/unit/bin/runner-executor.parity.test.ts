import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, expect, it } from 'vitest'
import { createRunnerExecutor } from '../../../bin/lib/executors/runner-executor'

describe('runner executor parity', () => {
  it('applyYaml and deleteYaml succeed for a pod manifest', () => {
    const executor = createRunnerExecutor()
    const tempDir = mkdtempSync(join(tmpdir(), 'runner-parity-'))
    const manifestPath = join(tempDir, 'test-pod.yaml')
    writeFileSync(
      manifestPath,
      [
        'apiVersion: v1',
        'kind: Pod',
        'metadata:',
        '  name: test-pod',
        '  namespace: default',
        'spec:',
        '  containers:',
        '    - name: app',
        '      image: busybox'
      ].join('\n')
    )

    try {
      const applyResult = executor.applyYaml({
        id: 'apply-test',
        type: 'applyYaml',
        targetPath: manifestPath
      })
      expect(applyResult.exitCode).toBe(0)

      const deleteResult = executor.deleteYaml({
        id: 'delete-test',
        type: 'deleteYaml',
        targetPath: manifestPath,
        ignoreNotFound: true
      })
      expect(deleteResult.exitCode).toBe(0)
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('provisions and binds a dynamic pvc after first consumer pod', () => {
    const executor = createRunnerExecutor()
    const tempDir = mkdtempSync(join(tmpdir(), 'runner-dynamic-storage-'))
    const pvcManifestPath = join(tempDir, 'dynamic-pvc.yaml')
    const podManifestPath = join(tempDir, 'dynamic-pod.yaml')
    writeFileSync(
      pvcManifestPath,
      [
        'apiVersion: v1',
        'kind: PersistentVolumeClaim',
        'metadata:',
        '  name: dynamic-pvc',
        'spec:',
        '  accessModes:',
        '    - ReadWriteOnce',
        '  resources:',
        '    requests:',
        '      storage: 100Mi'
      ].join('\n')
    )
    writeFileSync(
      podManifestPath,
      [
        'apiVersion: v1',
        'kind: Pod',
        'metadata:',
        '  name: dynamic-consumer',
        'spec:',
        '  volumes:',
        '    - name: storage',
        '      persistentVolumeClaim:',
        '        claimName: dynamic-pvc',
        '  containers:',
        '    - name: app',
        '      image: busybox:1.36',
        "      args: ['sleep', '3600']",
        '      volumeMounts:',
        '        - name: storage',
        '          mountPath: /data'
      ].join('\n')
    )

    try {
      const applyPvcResult = executor.applyYaml({
        id: 'apply-pvc',
        type: 'applyYaml',
        targetPath: pvcManifestPath
      })
      expect(applyPvcResult.exitCode).toBe(0)

      const beforeConsumerResult = executor.executeCommand(
        'kubectl get pvc dynamic-pvc'
      )
      expect(beforeConsumerResult.exitCode).toBe(0)
      expect(beforeConsumerResult.stdout).toContain('dynamic-pvc')
      expect(beforeConsumerResult.stdout).toContain('Pending')

      const applyPodResult = executor.applyYaml({
        id: 'apply-pod',
        type: 'applyYaml',
        targetPath: podManifestPath
      })
      expect(applyPodResult.exitCode).toBe(0)

      const waitResult = executor.executeCommand(
        'kubectl wait --for=condition=Ready pod/dynamic-consumer --timeout=60s'
      )
      expect(waitResult.exitCode).toBe(0)

      const pvcResult = executor.executeCommand('kubectl get pvc dynamic-pvc')
      expect(pvcResult.exitCode).toBe(0)
      expect(pvcResult.stdout).toContain('dynamic-pvc')
      expect(pvcResult.stdout).toContain('Bound')

      const pvResult = executor.executeCommand('kubectl get pv')
      expect(pvResult.exitCode).toBe(0)
      expect(pvResult.stdout).toContain('pvc-default-dynamic-pvc')

      executor.executeCommand('kubectl delete pod dynamic-consumer')
      executor.executeCommand('kubectl delete pvc dynamic-pvc')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('removes stale rollout pods after image update', () => {
    const executor = createRunnerExecutor()
    const tempDir = mkdtempSync(join(tmpdir(), 'runner-rollout-'))
    const deploymentManifestPath = join(tempDir, 'web-deployment.yaml')
    writeFileSync(
      deploymentManifestPath,
      [
        'apiVersion: apps/v1',
        'kind: Deployment',
        'metadata:',
        '  name: web-app',
        'spec:',
        '  replicas: 2',
        '  selector:',
        '    matchLabels:',
        '      app: web',
        '  template:',
        '    metadata:',
        '      labels:',
        '        app: web',
        '    spec:',
        '      containers:',
        '        - name: web',
        '          image: nginx:1.28'
      ].join('\n')
    )

    try {
      const applyResult = executor.applyYaml({
        id: 'apply-deployment',
        type: 'applyYaml',
        targetPath: deploymentManifestPath
      })
      expect(applyResult.exitCode).toBe(0)

      const firstRolloutResult = executor.executeCommand(
        'kubectl rollout status deployment/web-app'
      )
      expect(firstRolloutResult.exitCode).toBe(0)

      const setImageResult = executor.executeCommand(
        'kubectl set image deployment/web-app web=nginx:1.26'
      )
      expect(setImageResult.exitCode).toBe(0)

      const secondRolloutResult = executor.executeCommand(
        'kubectl rollout status deployment/web-app'
      )
      expect(secondRolloutResult.exitCode).toBe(0)

      const imageListResult = executor.executeCommand(
        `kubectl get pods -l app=web -o jsonpath='{range .items[*]}{.spec.containers[0].image}{" "}{end}'`
      )
      expect(imageListResult.exitCode).toBe(0)
      expect(imageListResult.stdout).toContain('nginx:1.26')

      executor.executeCommand('kubectl delete deployment web-app')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('keeps static pv and pvc exercise stable with explicit readiness wait', () => {
    const executor = createRunnerExecutor()
    const tempDir = mkdtempSync(join(tmpdir(), 'runner-static-storage-'))
    const pvManifestPath = join(tempDir, 'my-pv.yaml')
    const pvcManifestPath = join(tempDir, 'my-pvc.yaml')
    const podManifestPath = join(tempDir, 'pvc-pod.yaml')
    writeFileSync(
      pvManifestPath,
      [
        'apiVersion: v1',
        'kind: PersistentVolume',
        'metadata:',
        '  name: my-pv',
        'spec:',
        '  capacity:',
        '    storage: 1Gi',
        '  accessModes:',
        '    - ReadWriteOnce',
        '  storageClassName: ""',
        '  hostPath:',
        '    path: /tmp/my-pv-data'
      ].join('\n')
    )
    writeFileSync(
      pvcManifestPath,
      [
        'apiVersion: v1',
        'kind: PersistentVolumeClaim',
        'metadata:',
        '  name: my-pvc',
        'spec:',
        '  storageClassName: ""',
        '  accessModes:',
        '    - ReadWriteOnce',
        '  resources:',
        '    requests:',
        '      storage: 500Mi'
      ].join('\n')
    )
    writeFileSync(
      podManifestPath,
      [
        'apiVersion: v1',
        'kind: Pod',
        'metadata:',
        '  name: pvc-pod',
        'spec:',
        '  volumes:',
        '    - name: storage',
        '      persistentVolumeClaim:',
        '        claimName: my-pvc',
        '  initContainers:',
        '    - name: write-data',
        '      image: busybox:1.36',
        '      command: ["sh"]',
        '      args: ["-c", "echo data persisted > /data/hello.txt"]',
        '      volumeMounts:',
        '        - name: storage',
        '          mountPath: /data',
        '  containers:',
        '    - name: app',
        '      image: nginx:1.28',
        '      volumeMounts:',
        '        - name: storage',
        '          mountPath: /data'
      ].join('\n')
    )

    try {
      executor.executeCommand('kubectl delete pod pvc-pod')
      executor.executeCommand('kubectl delete pvc my-pvc')
      executor.executeCommand('kubectl delete pv my-pv')

      const applyPvResult = executor.applyYaml({
        id: 'apply-static-pv',
        type: 'applyYaml',
        targetPath: pvManifestPath
      })
      expect(applyPvResult.exitCode).toBe(0)

      const applyPvcResult = executor.applyYaml({
        id: 'apply-static-pvc',
        type: 'applyYaml',
        targetPath: pvcManifestPath
      })
      expect(applyPvcResult.exitCode).toBe(0)

      const pvcStatusResult = executor.executeCommand('kubectl get pvc my-pvc')
      expect(pvcStatusResult.exitCode).toBe(0)
      expect(pvcStatusResult.stdout).toContain('Bound')

      const applyPodResult = executor.applyYaml({
        id: 'apply-static-pod',
        type: 'applyYaml',
        targetPath: podManifestPath
      })
      expect(applyPodResult.exitCode).toBe(0)

      const waitReadyResult = executor.executeCommand(
        'kubectl wait --for=condition=Ready pod/pvc-pod --timeout=60s'
      )
      expect(waitReadyResult.exitCode).toBe(0)

      const firstExecResult = executor.executeCommand(
        'kubectl exec pvc-pod -- cat /data/hello.txt'
      )
      expect(firstExecResult.exitCode).toBe(0)
      expect(firstExecResult.stdout).toContain('data persisted')
      expect(firstExecResult.stderr).toContain(
        'Defaulted container "app" out of: app, write-data (init)'
      )

      const deletePodResult = executor.executeCommand(
        'kubectl delete pod pvc-pod'
      )
      expect(deletePodResult.exitCode).toBe(0)

      const recreatePodResult = executor.applyYaml({
        id: 'recreate-static-pod',
        type: 'applyYaml',
        targetPath: podManifestPath
      })
      expect(recreatePodResult.exitCode).toBe(0)

      const secondWaitReadyResult = executor.executeCommand(
        'kubectl wait --for=condition=Ready pod/pvc-pod --timeout=60s'
      )
      expect(secondWaitReadyResult.exitCode).toBe(0)

      const secondExecResult = executor.executeCommand(
        'kubectl exec pvc-pod -- cat /data/hello.txt'
      )
      expect(secondExecResult.exitCode).toBe(0)
      expect(secondExecResult.stdout).toContain('data persisted')
      expect(secondExecResult.stderr).toContain(
        'Defaulted container "app" out of: app, write-data (init)'
      )

      const pvStatusResult = executor.executeCommand('kubectl get pv my-pv')
      expect(pvStatusResult.exitCode).toBe(0)
      expect(pvStatusResult.stdout).toContain('Bound')

      const finalPvcStatusResult = executor.executeCommand(
        'kubectl get pvc my-pvc'
      )
      expect(finalPvcStatusResult.exitCode).toBe(0)
      expect(finalPvcStatusResult.stdout).toContain('Bound')
    } finally {
      executor.executeCommand('kubectl delete pod pvc-pod')
      executor.executeCommand('kubectl delete pvc my-pvc')
      executor.executeCommand('kubectl delete pv my-pv')
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
