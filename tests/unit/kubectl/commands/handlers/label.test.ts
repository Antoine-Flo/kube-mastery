import { beforeEach, describe, expect, it } from 'vitest'
import { handleLabel } from '../../../../../src/core/kubectl/commands/handlers/label'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'

describe('kubectl label handler', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>

  beforeEach(() => {
    apiServer = createApiServerFacade()
  })

  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => ({
    action: 'label',
    resource: 'pods',
    flags: {},
    ...overrides
  })

  it('should add label to pod', () => {
    const pod = createPod({
      name: 'my-pod',
      namespace: 'default',
      containers: [{ name: 'main', image: 'nginx:latest' }]
    })
    apiServer.createResource('Pod', pod)
    const parsed = createParsedCommand({
      name: 'my-pod',
      labelChanges: { app: 'web' }
    })

    const result = handleLabel(apiServer, parsed)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('labeled')
    }
  })

  it('should return error when name is missing', () => {
    const parsed = createParsedCommand({
      labelChanges: { app: 'test' }
    })

    const result = handleLabel(apiServer, parsed)

    expect(result.ok).toBe(false)
  })

  it('should return error when no label changes provided', () => {
    const parsed = createParsedCommand({
      name: 'my-pod'
    })

    const result = handleLabel(apiServer, parsed)

    expect(result.ok).toBe(false)
  })
})
