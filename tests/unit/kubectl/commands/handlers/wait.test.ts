import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createEventBus } from '../../../../../src/core/cluster/events/EventBus'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { handleWait } from '../../../../../src/core/kubectl/commands/handlers/wait'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'

const createParsedCommand = (
  overrides: Partial<ParsedCommand> = {}
): ParsedCommand => {
  return {
    action: 'wait',
    resource: 'pods',
    name: 'web',
    namespace: 'default',
    waitForCondition: 'condition=Ready',
    waitTimeoutSeconds: 3,
    flags: {},
    ...overrides
  }
}

describe('handleWait', () => {
  it('returns error when resource is not pods', () => {
    const apiServer = createApiServerFacade({ eventBus: createEventBus() })
    const parsed = createParsedCommand({ resource: 'services' })
    const result = handleWait(apiServer, parsed)
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error).toContain('only supported for pods')
  })

  it('returns error when name is missing', () => {
    const apiServer = createApiServerFacade({ eventBus: createEventBus() })
    const parsed = createParsedCommand({ name: '' })
    const result = handleWait(apiServer, parsed)
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error).toContain('wait requires a resource name')
  })

  it('returns error for unsupported --for condition', () => {
    const apiServer = createApiServerFacade({ eventBus: createEventBus() })
    const parsed = createParsedCommand({ waitForCondition: 'delete' })
    const result = handleWait(apiServer, parsed)
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error).toContain('only supports --for=condition=Ready')
  })

  it('returns no matching resources when pod is absent', () => {
    const apiServer = createApiServerFacade({ eventBus: createEventBus() })
    const result = handleWait(apiServer, createParsedCommand())
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error).toContain('no matching resources found')
  })

  it('returns success when pod is already ready', () => {
    const apiServer = createApiServerFacade({ eventBus: createEventBus() })
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'web',
        namespace: 'default',
        phase: 'Running',
        containers: [{ name: 'app', image: 'nginx' }],
        containerStatusOverrides: [{ name: 'app', ready: true, restartCount: 0 }]
      })
    )
    const result = handleWait(apiServer, createParsedCommand())
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('pod/web condition met')
  })

  it('times out when only partial container statuses are ready', () => {
    const apiServer = createApiServerFacade({ eventBus: createEventBus() })
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'web',
        namespace: 'default',
        phase: 'Running',
        containers: [
          { name: 'app', image: 'nginx' },
          { name: 'sidecar', image: 'busybox' }
        ],
        containerStatusOverrides: [
          { name: 'app', ready: true, restartCount: 0 },
          { name: 'sidecar', ready: false, restartCount: 0 }
        ]
      })
    )
    const result = handleWait(
      apiServer,
      createParsedCommand({ waitTimeoutSeconds: 1 })
    )
    expect(result.ok).toBe(false)
    if (result.ok) {
      return
    }
    expect(result.error).toContain('timed out waiting for condition')
  })

  it('reconciles and succeeds when pod becomes ready during loop', () => {
    const apiServer = createApiServerFacade({ eventBus: createEventBus() })
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'web',
        namespace: 'default',
        phase: 'Pending',
        containers: [{ name: 'app', image: 'nginx' }]
      })
    )

    let reconcileCalls = 0
    const result = handleWait(apiServer, createParsedCommand(), () => {
      reconcileCalls += 1
      if (reconcileCalls !== 2) {
        return
      }
      apiServer.updateResource(
        'Pod',
        'web',
        createPod({
          name: 'web',
          namespace: 'default',
          phase: 'Running',
          containers: [{ name: 'app', image: 'nginx' }],
          containerStatusOverrides: [{ name: 'app', ready: true, restartCount: 0 }]
        }),
        'default'
      )
    })

    expect(reconcileCalls).toBeGreaterThan(1)
    expect(result.ok).toBe(true)
  })
})
