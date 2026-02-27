import { describe, expect, it } from 'vitest'
import { createClusterStateData } from '../../../helpers/utils'
import { createIngress } from '../../../../../src/core/cluster/ressources/Ingress'
import { handleGet } from '../../../../../src/core/kubectl/commands/handlers/get'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'

const createParsedCommand = (
  overrides: Partial<ParsedCommand> = {}
): ParsedCommand => {
  return {
    action: 'get',
    resource: 'ingresses',
    flags: {},
    ...overrides
  }
}

describe('kubectl get handler - ingresses', () => {
  it('should render ingress table output', () => {
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
                }
              ]
            }
          }
        ]
      }
    })
    const state = createClusterStateData({ ingresses: [ingress] })
    const output = handleGet(state, createParsedCommand())

    expect(output).toContain('NAME')
    expect(output).toContain('CLASS')
    expect(output).toContain('HOSTS')
    expect(output).toContain('ADDRESS')
    expect(output).toContain('PORTS')
    expect(output).toContain('demo-ingress')
    expect(output).toContain('demo.example.com')
  })

  it('should support structured JSON output', () => {
    const ingress = createIngress({
      name: 'demo-ingress',
      namespace: 'default',
      spec: {
        rules: [
          {
            http: {
              paths: [
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
    const output = handleGet(
      state,
      createParsedCommand({
        flags: { output: 'json' }
      })
    )

    expect(output).toContain('"kind": "List"')
    expect(output).toContain('"apiVersion": "networking.k8s.io/v1"')
    expect(output).toContain('"demo-ingress"')
  })

  it('should return no resources for ingressclass when none exist', () => {
    const state = createClusterStateData()
    const output = handleGet(state, {
      action: 'get',
      resource: 'ingressclasses',
      flags: {}
    })

    expect(output).toBe('No resources found')
  })
})
