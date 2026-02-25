import { describe, expect, it } from 'vitest'
import { createClusterState } from '../../../../../src/core/cluster/ClusterState'
import { createEventBus } from '../../../../../src/core/cluster/events/EventBus'
import { createDeployment } from '../../../../../src/core/cluster/ressources/Deployment'
import { handleExpose } from '../../../../../src/core/kubectl/commands/handlers/expose'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'

const createParsedExpose = (
  overrides: Partial<ParsedCommand> = {}
): ParsedCommand => {
  return {
    action: 'expose',
    resource: 'deployments',
    name: 'web',
    flags: { port: '80' },
    port: 80,
    ...overrides
  }
}

describe('kubectl expose handler', () => {
  it('should create a service from deployment expose', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus)
    clusterState.addDeployment(
      createDeployment({
        name: 'web',
        namespace: 'default',
        selector: { matchLabels: { app: 'web' } },
        template: {
          metadata: { labels: { app: 'web' } },
          spec: {
            containers: [
              {
                name: 'web',
                image: 'nginx',
                ports: [{ containerPort: 8080 }]
              }
            ]
          }
        }
      })
    )

    const result = handleExpose(
      clusterState,
      createParsedExpose(),
      eventBus
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('service/web created')

    const serviceResult = clusterState.findService('web', 'default')
    expect(serviceResult.ok).toBe(true)
    if (!serviceResult.ok) {
      return
    }
    expect(serviceResult.value.spec.selector).toEqual({ app: 'web' })
    expect(serviceResult.value.spec.ports[0].port).toBe(80)
    expect(serviceResult.value.spec.ports[0].targetPort).toBe(8080)
  })

  it('should return not found when deployment does not exist', () => {
    const eventBus = createEventBus()
    const clusterState = createClusterState(eventBus)
    const result = handleExpose(
      clusterState,
      createParsedExpose({ name: 'missing' }),
      eventBus
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('deployments.apps "missing" not found')
    }
  })
})
