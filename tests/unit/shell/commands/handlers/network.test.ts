import { describe, expect, it } from 'vitest'
import { success } from '../../../../../src/core/shared/result'
import { createCurlHandler } from '../../../../../src/core/shell/commands/handlers/network/curl'
import { createNslookupHandler } from '../../../../../src/core/shell/commands/handlers/network/nslookup'
import { createExitHandler } from '../../../../../src/core/shell/commands/handlers/system/exit'

describe('Network Handlers', () => {
  describe('nslookup', () => {
    it('should resolve query with injected runtime callback', () => {
      const handler = createNslookupHandler({
        resolveNamespace: () => 'dev',
        runDnsLookup: (query, namespace) => {
          return success(`query=${query} namespace=${namespace}`)
        }
      })

      const result = handler.execute(['web.dev.svc.cluster.local'], {})

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe(
          'query=web.dev.svc.cluster.local namespace=dev'
        )
      }
    })

    it('should return usage-like error when query is missing', () => {
      const handler = createNslookupHandler()
      const result = handler.execute([], {})

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('NXDOMAIN')
      }
    })
  })

  describe('curl', () => {
    it('should execute with injected runtime callback', () => {
      const handler = createCurlHandler({
        resolveNamespace: () => 'dev',
        runCurl: (target, namespace) => {
          return success(`target=${target} namespace=${namespace}`)
        }
      })

      const result = handler.execute(['http://web:80'], {})

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe('target=http://web:80 namespace=dev')
      }
    })

    it('should return usage error when target is missing', () => {
      const handler = createCurlHandler()
      const result = handler.execute([], {})

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain('curl <url>')
      }
    })
  })

  describe('exit', () => {
    it('should invoke onExit callback when provided', () => {
      const handler = createExitHandler({
        onExit: () => success('exited')
      })
      const result = handler.execute([], {})

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value).toBe('exited')
      }
    })
  })
})
