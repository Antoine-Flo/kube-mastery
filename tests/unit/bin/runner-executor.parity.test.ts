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
})
