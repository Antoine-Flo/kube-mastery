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
})
