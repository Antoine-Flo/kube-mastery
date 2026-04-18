import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { handleRun } from '../../../../../src/core/kubectl/commands/handlers/run'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'

const createParsedCommand = (
  overrides: Partial<ParsedCommand> = {}
): ParsedCommand => {
  return {
    action: 'run',
    resource: 'pods',
    name: 'demo',
    flags: {},
    runImage: 'nginx:1.28',
    ...overrides
  }
}

describe('kubectl run handler', () => {
  it('should reject tty without stdin', () => {
    const apiServer = createApiServerFacade()
    const parsed = createParsedCommand({
      runTty: true,
      runStdin: false
    })

    const result = handleRun(apiServer, parsed)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        '-i/--stdin is required for containers with -t/--tty=true'
      )
    }
  })

  it('should reject dry-run with attached options', () => {
    const apiServer = createApiServerFacade()
    const parsed = createParsedCommand({
      flags: { 'dry-run': 'client', attach: true }
    })

    const result = handleRun(apiServer, parsed)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        "--dry-run=[server|client] can't be used with attached containers options"
      )
    }
  })

  it('should reject invalid image name format', () => {
    const apiServer = createApiServerFacade()
    const parsed = createParsedCommand({
      runImage: 'bad image'
    })

    const result = handleRun(apiServer, parsed)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Invalid image name "bad image"')
    }
  })

  it('should default restart policy to OnFailure for interactive runs', () => {
    const apiServer = createApiServerFacade()
    const parsed = createParsedCommand({
      name: 'interactive-pod',
      runStdin: true
    })

    const result = handleRun(apiServer, parsed)
    expect(result.ok).toBe(true)

    const createdPod = apiServer.findResource('Pod', 'interactive-pod', 'default')
    expect(createdPod.ok).toBe(true)
    if (!createdPod.ok) {
      return
    }
    expect(createdPod.value.spec.restartPolicy).toBe('OnFailure')
  })

  it('should not mutate cluster state on run --dry-run=server', () => {
    const apiServer = createApiServerFacade()
    const parsed = createParsedCommand({
      name: 'dry-run-server-pod',
      flags: { 'dry-run': 'server' }
    })

    const result = handleRun(apiServer, parsed)
    expect(result.ok).toBe(true)

    const podResult = apiServer.findResource('Pod', 'dry-run-server-pod', 'default')
    expect(podResult.ok).toBe(false)
  })

  it('should reject invalid image pull policy', () => {
    const apiServer = createApiServerFacade()
    const parsed = createParsedCommand({
      flags: { 'image-pull-policy': 'Sometimes' }
    })

    const result = handleRun(apiServer, parsed)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('invalid image pull policy: Sometimes')
    }
  })
})
