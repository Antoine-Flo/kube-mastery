import { describe, expect, it } from 'vitest'
import { createClusterStateData } from '../../../helpers/utils'
import { createIngress } from '../../../../../src/core/cluster/ressources/Ingress'
import { handleDescribe } from '../../../../../src/core/kubectl/commands/handlers/describe'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'

const createParsedCommand = (
  overrides: Partial<ParsedCommand> = {}
): ParsedCommand => {
  return {
    action: 'describe',
    resource: 'ingresses',
    name: 'demo-ingress',
    flags: {},
    ...overrides
  }
}

describe('kubectl describe handler - ingresses', () => {
  it('should describe ingress rules and backends', () => {
    const ingress = createIngress({
      name: 'demo-ingress',
      namespace: 'default',
      spec: {
        rules: [
          {
            host: 'demo.example.com',
            http: {
              paths: [
                {
                  path: '/api',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: 'api-service',
                      port: { number: 80 }
                    }
                  }
                },
                {
                  path: '/',
                  pathType: 'Prefix',
                  backend: {
                    service: {
                      name: 'frontend-service',
                      port: { number: 80 }
                    }
                  }
                }
              ]
            }
          }
        ]
      }
    })
    const state = createClusterStateData({ ingresses: [ingress] })
    const result = handleDescribe(state, createParsedCommand())

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('Name:')
    expect(result.value).toContain('demo-ingress')
    expect(result.value).toContain('Rules:')
    expect(result.value).toContain('/api')
    expect(result.value).toContain('api-service:80')
    expect(result.value).toContain('frontend-service:80')
  })
})
