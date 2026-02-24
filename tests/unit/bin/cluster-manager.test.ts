import { beforeEach, describe, expect, it, vi } from 'vitest'

const execSyncMock = vi.hoisted(() => {
  return vi.fn()
})

vi.mock('child_process', () => {
  return {
    execSync: execSyncMock
  }
})

import { waitForPodsReady } from '../../../bin/lib/cluster-manager'

const buildPod = (
  namespace: string,
  name: string,
  phase: string,
  readyStatuses: boolean[]
): Record<string, unknown> => {
  return {
    metadata: {
      namespace,
      name
    },
    status: {
      phase,
      containerStatuses: readyStatuses.map((ready) => {
        return { ready }
      })
    }
  }
}

describe('cluster-manager waitForPodsReady', () => {
  beforeEach(() => {
    execSyncMock.mockReset()
  })

  it('returns success when kubectl wait succeeds', () => {
    execSyncMock.mockImplementation((command: string) => {
      if (command.startsWith('kubectl wait ')) {
        return ''
      }
      throw new Error(`Unexpected command: ${command}`)
    })

    const result = waitForPodsReady()

    expect(result.ok).toBe(true)
    expect(execSyncMock).toHaveBeenCalledTimes(1)
    expect(execSyncMock).toHaveBeenCalledWith(
      'kubectl wait --for=condition=Ready pod --all --all-namespaces --timeout=60s',
      { stdio: 'pipe' }
    )
  })

  it('fails strictly when wait fails and reports unresolved pods', () => {
    execSyncMock.mockImplementation((command: string) => {
      if (command.startsWith('kubectl wait ')) {
        throw new Error('timed out')
      }
      if (command.startsWith('kubectl get pods ')) {
        return JSON.stringify({
          items: [
            buildPod('kube-system', 'ready-running', 'Running', [true]),
            buildPod('kube-system', 'not-ready-running', 'Running', [false]),
            buildPod('default', 'pending-no-status', 'Pending', []),
            buildPod('default', 'done-job', 'Succeeded', [false])
          ]
        })
      }
      throw new Error(`Unexpected command: ${command}`)
    })

    const result = waitForPodsReady('kube-system')

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('Expected waitForPodsReady to fail')
    }
    expect(result.error).toContain('namespace "kube-system"')
    expect(result.error).toContain('kube-system/not-ready-running:Running')
    expect(result.error).toContain('default/pending-no-status:Pending')
    expect(result.error).not.toContain('kube-system/ready-running:Running')
    expect(result.error).not.toContain('default/done-job:Succeeded')
  })

  it('limits unresolved pod output to 12 entries', () => {
    execSyncMock.mockImplementation((command: string) => {
      if (command.startsWith('kubectl wait ')) {
        throw new Error('timed out')
      }
      if (command.startsWith('kubectl get pods ')) {
        const items = Array.from({ length: 13 }, (_, index) => {
          return buildPod('kube-system', `pending-${index}`, 'Pending', [])
        })
        return JSON.stringify({ items })
      }
      throw new Error(`Unexpected command: ${command}`)
    })

    const result = waitForPodsReady()

    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error('Expected waitForPodsReady to fail')
    }
    expect(result.error).toContain('all namespaces')
    expect(result.error).toContain('kube-system/pending-0:Pending')
    expect(result.error).toContain(', ...')
  })
})
