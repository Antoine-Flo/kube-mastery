import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createServiceAccount } from '../../../../../src/core/cluster/ressources/ServiceAccount'
import { handleCreateToken } from '../../../../../src/core/kubectl/commands/handlers/createToken'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'

const createParsedCommand = (
  overrides: Partial<ParsedCommand> = {}
): ParsedCommand => {
  return {
    action: 'create-token',
    flags: {},
    ...overrides
  }
}

describe('kubectl create token handler', () => {
  it('should return an explicit error when serviceaccount name is missing', () => {
    const apiServer = createApiServerFacade()
    const parsed = createParsedCommand()

    const result = handleCreateToken(apiServer, parsed)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe('error: create token requires a serviceaccount name')
    }
  })

  it('should return NotFound when serviceaccount does not exist', () => {
    const apiServer = createApiServerFacade()
    const parsed = createParsedCommand({
      name: 'missing-sa',
      namespace: 'default'
    })

    const result = handleCreateToken(apiServer, parsed)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toBe(
        'Error from server (NotFound): serviceaccounts "missing-sa" not found'
      )
    }
  })

  it('should generate a JWT-like token for an existing serviceaccount', () => {
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'ServiceAccount',
      createServiceAccount({
        name: 'robot',
        namespace: 'default'
      })
    )
    const parsed = createParsedCommand({
      name: 'robot',
      namespace: 'default'
    })

    const result = handleCreateToken(apiServer, parsed)

    expect(result.ok).toBe(true)
    if (result.ok) {
      const tokenParts = result.value.split('.')
      expect(tokenParts).toHaveLength(3)
      expect(tokenParts[0]).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(tokenParts[1]).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(tokenParts[2]).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it('should generate token when Buffer is unavailable in browser-like runtime', () => {
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'ServiceAccount',
      createServiceAccount({
        name: 'robot',
        namespace: 'default'
      })
    )
    const parsed = createParsedCommand({
      name: 'robot',
      namespace: 'default'
    })

    const runtimeGlobals = globalThis as typeof globalThis & {
      Buffer?: typeof Buffer
      btoa?: (value: string) => string
    }
    const originalBuffer = runtimeGlobals.Buffer
    const originalBtoa = runtimeGlobals.btoa

    if (originalBuffer == null) {
      throw new Error('Expected Buffer to exist in test runtime')
    }

    runtimeGlobals.Buffer = undefined
    if (typeof runtimeGlobals.btoa !== 'function') {
      runtimeGlobals.btoa = (value: string) => {
        return originalBuffer.from(value, 'binary').toString('base64')
      }
    }

    try {
      const result = handleCreateToken(apiServer, parsed)
      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.split('.')).toHaveLength(3)
      }
    } finally {
      runtimeGlobals.Buffer = originalBuffer
      if (originalBtoa != null) {
        runtimeGlobals.btoa = originalBtoa
      } else {
        runtimeGlobals.btoa = undefined
      }
    }
  })
})
