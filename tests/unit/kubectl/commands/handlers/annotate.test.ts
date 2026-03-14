import { beforeEach, describe, expect, it } from 'vitest'
import { handleAnnotate } from '../../../../../src/core/kubectl/commands/handlers/annotate'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'

describe('kubectl annotate handler', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>

  beforeEach(() => {
    apiServer = createApiServerFacade()
  })

  const createParsedCommand = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => ({
    action: 'annotate',
    resource: 'pods',
    flags: {},
    ...overrides
  })

  it('should add annotation to pod', () => {
    const pod = createPod({
      name: 'my-pod',
      namespace: 'default',
      containers: [{ name: 'main', image: 'nginx:latest' }]
    })
    apiServer.createResource('Pod', pod)
    const parsed = createParsedCommand({
      name: 'my-pod',
      annotationChanges: { description: 'My application' }
    })

    const result = handleAnnotate(apiServer, parsed)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('annotated')
    }
  })

  it('should return error when name is missing', () => {
    const parsed = createParsedCommand({
      annotationChanges: { key: 'value' }
    })

    const result = handleAnnotate(apiServer, parsed)

    expect(result.ok).toBe(false)
  })

  it('should return error when no annotation changes provided', () => {
    const parsed = createParsedCommand({
      name: 'my-pod'
    })

    const result = handleAnnotate(apiServer, parsed)

    expect(result.ok).toBe(false)
  })
})
