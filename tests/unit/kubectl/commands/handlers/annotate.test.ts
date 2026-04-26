import { beforeEach, describe, expect, it } from 'vitest'
import { handleAnnotate } from '../../../../../src/core/kubectl/commands/handlers/annotate'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { parseCommand } from '../../../../../src/core/kubectl/commands/parser'
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

  it('should parse and apply annotate command with quoted value and overwrite', () => {
    const pod = createPod({
      name: 'my-pod',
      namespace: 'default',
      containers: [{ name: 'main', image: 'nginx:latest' }],
      annotations: { contact: 'platform-team@example.com' }
    })
    apiServer.createResource('Pod', pod)

    const parsed = parseCommand(
      'kubectl annotate pod my-pod contact="new-team@example.com" --overwrite'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleAnnotate(apiServer, parsed.value)
    expect(result.ok).toBe(true)

    const updatedPod = apiServer.findResource('Pod', 'my-pod', 'default')
    expect(updatedPod.ok).toBe(true)
    if (updatedPod.ok) {
      expect(updatedPod.value.metadata.annotations?.contact).toBe(
        'new-team@example.com'
      )
    }
  })

  it('should not mutate resource on annotate --dry-run=server', () => {
    const pod = createPod({
      name: 'dry-run-pod',
      namespace: 'default',
      containers: [{ name: 'main', image: 'nginx:latest' }],
      annotations: { owner: 'team-a' }
    })
    apiServer.createResource('Pod', pod)

    const parsed = createParsedCommand({
      name: 'dry-run-pod',
      flags: { 'dry-run': 'server' },
      annotationChanges: { description: 'preview-only' }
    })

    const result = handleAnnotate(apiServer, parsed)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('(server dry run)')

    const updatedPod = apiServer.findResource('Pod', 'dry-run-pod', 'default')
    expect(updatedPod.ok).toBe(true)
    if (!updatedPod.ok) {
      return
    }
    expect(updatedPod.value.metadata.annotations).toEqual({ owner: 'team-a' })
  })
})
