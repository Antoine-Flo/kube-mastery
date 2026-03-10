import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { describe, expect, it } from 'vitest'
import { createRunnerExecutor } from '../../../bin/lib/executors/runner-executor'

describe('runner executor parity', () => {
  it('fails waitPodsReady for invalid image instead of bypassing readiness', () => {
    const executor = createRunnerExecutor()
    const tempDir = mkdtempSync(join(tmpdir(), 'runner-parity-'))
    const manifestPath = join(tempDir, 'bad-image-pod.yaml')
    writeFileSync(
      manifestPath,
      [
        'apiVersion: v1',
        'kind: Pod',
        'metadata:',
        '  name: bad-image-pod',
        '  namespace: default',
        'spec:',
        '  containers:',
        '    - name: app',
        '      image: invalid.registry.local/app:latest'
      ].join('\n')
    )

    try {
      const applyResult = executor.applyYaml({
        id: 'apply-bad-image',
        type: 'applyYaml',
        targetPath: manifestPath
      })
      expect(applyResult.exitCode).toBe(0)

      const waitResult = executor.waitPodsReady({
        id: 'wait-default',
        type: 'waitPodsReady',
        namespace: 'default'
      })

      expect(waitResult.exitCode).toBe(1)
      expect(waitResult.stderr).toContain(
        'Timed out waiting for pods to become Ready in namespace "default".'
      )
      expect(waitResult.stderr).toContain('default/bad-image-pod:Pending')
    } finally {
      executor.deleteYaml({
        id: 'cleanup-bad-image',
        type: 'deleteYaml',
        targetPath: manifestPath,
        ignoreNotFound: true
      })
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
