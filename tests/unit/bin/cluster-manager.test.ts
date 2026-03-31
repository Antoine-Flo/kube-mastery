import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { execSync } from 'child_process'
import {
  applyYamlTarget,
  deleteYamlTarget,
  getSeedPath,
  listYamlFiles,
  loadClusterNodeRoles,
  resetConformanceClusterState
} from '../../../bin/lib/cluster-manager'

vi.mock('child_process', () => {
  return {
    execSync: vi.fn()
  }
})

describe('cluster-manager', () => {
  const tempDirs: string[] = []

  afterEach(() => {
    vi.restoreAllMocks()
    for (const dir of tempDirs) {
      rmSync(dir, { recursive: true, force: true })
    }
    tempDirs.length = 0
  })

  it('getSeedPath returns path under courses seeds', () => {
    const path = getSeedPath('minimal')
    expect(path).toContain('seeds')
    expect(path).toContain('minimal')
  })

  it('listYamlFiles scans directories recursively and sorts results', () => {
    const rootDir = mkdtempSync(
      join(process.cwd(), '.tmp-cluster-manager-yaml-')
    )
    tempDirs.push(rootDir)
    writeFileSync(join(rootDir, 'b.yaml'), 'kind: Pod\n')
    writeFileSync(join(rootDir, 'a.txt'), 'ignored\n')
    const nestedDir = join(rootDir, 'nested')
    mkdirSync(nestedDir, { recursive: true })
    writeFileSync(join(rootDir, 'nested.yml'), 'kind: Service\n')
    writeFileSync(join(rootDir, 'pod.json'), '{}\n')
    writeFileSync(join(rootDir, 'nested', '.keep'), '')
    writeFileSync(join(rootDir, 'nested', 'z.yaml'), 'kind: ConfigMap\n')

    const files = listYamlFiles(rootDir)
    expect(files).toHaveLength(3)
    expect(files[0] <= files[1]).toBe(true)
    expect(files[1] <= files[2]).toBe(true)
    expect(files.join('\n')).toContain('b.yaml')
    expect(files.join('\n')).toContain('nested.yml')
    expect(files.join('\n')).toContain('z.yaml')
  })

  it('applyYamlTarget rejects non-yaml targets', () => {
    const rootDir = mkdtempSync(
      join(process.cwd(), '.tmp-cluster-manager-target-')
    )
    tempDirs.push(rootDir)
    const jsonPath = join(rootDir, 'pod.json')
    writeFileSync(jsonPath, '{}')

    const result = applyYamlTarget(jsonPath)
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error).toContain('Target is not a YAML file')
  })

  it('deleteYamlTarget rejects directories without yaml files', () => {
    const rootDir = mkdtempSync(
      join(process.cwd(), '.tmp-cluster-manager-empty-')
    )
    tempDirs.push(rootDir)
    writeFileSync(join(rootDir, 'README.md'), '# none')

    const result = deleteYamlTarget(rootDir, true)
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error).toContain('No YAML files found')
  })

  it('loadClusterNodeRoles parses kind config', () => {
    const rootDir = mkdtempSync(
      join(process.cwd(), '.tmp-cluster-manager-kind-')
    )
    tempDirs.push(rootDir)
    const kindConfigPath = join(rootDir, 'kind.yaml')
    writeFileSync(
      kindConfigPath,
      [
        'kind: Cluster',
        'apiVersion: kind.x-k8s.io/v1alpha4',
        'nodes:',
        '  - role: control-plane',
        '  - role: worker'
      ].join('\n')
    )

    const relativePath = kindConfigPath.replace(`${process.cwd()}/`, '')
    const result = loadClusterNodeRoles(relativePath)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toEqual(['control-plane', 'worker'])
  })

  it('resetConformanceClusterState skips protected namespaces', () => {
    vi.mocked(execSync).mockImplementation((command) => {
        const commandString = String(command)
        if (commandString === 'kubectl get namespaces -o json') {
          return JSON.stringify({
            items: [
              { metadata: { name: 'default' } },
              { metadata: { name: 'kube-system' } },
              { metadata: { name: 'feature-a' } }
            ]
          })
        }
        if (commandString.startsWith('kubectl get ') && commandString.includes('-o json')) {
          return JSON.stringify({ items: [] })
        }
        return ''
      })

    const result = resetConformanceClusterState()
    expect(result.ok).toBe(true)

    const calls = vi.mocked(execSync).mock.calls.map(([command]) =>
      String(command)
    )
    expect(
      calls.some((command) =>
        command.includes('kubectl delete namespace feature-a')
      )
    ).toBe(true)
    expect(
      calls.some((command) =>
        command.includes('kubectl delete namespace kube-system')
      )
    ).toBe(false)
  })
})
