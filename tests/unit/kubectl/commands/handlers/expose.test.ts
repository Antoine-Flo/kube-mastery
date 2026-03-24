import { describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createDeployment } from '../../../../../src/core/cluster/ressources/Deployment'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
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
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Deployment',
      createDeployment({
        name: 'web',
        namespace: 'default',
        labels: { app: 'web', env: 'prod' },
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

    const result = handleExpose(apiServer, createParsedExpose())
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('service/web created')

    const serviceResult = apiServer.findResource('Service', 'web', 'default')
    expect(serviceResult.ok).toBe(true)
    if (!serviceResult.ok) {
      return
    }
    expect(serviceResult.value.spec.selector).toEqual({ app: 'web' })
    expect(serviceResult.value.metadata.labels).toEqual({ app: 'web', env: 'prod' })
    expect(serviceResult.value.spec.ports[0].port).toBe(80)
    expect(serviceResult.value.spec.ports[0].targetPort).toBe(8080)
  })

  it('should return not found when deployment does not exist', () => {
    const apiServer = createApiServerFacade()
    const result = handleExpose(
      apiServer,
      createParsedExpose({ name: 'missing' })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('deployments.apps "missing" not found')
    }
  })

  it('should reject non equality selector for expose', () => {
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Deployment',
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
      apiServer,
      createParsedExpose({
        selector: {
          requirements: [
            {
              key: 'track',
              operator: 'NotIn',
              values: ['canary']
            }
          ]
        }
      })
    )

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain(
        'selector for expose must be equality-based'
      )
    }
  })

  it('should create a service from pod expose with explicit selector', () => {
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'web-prod',
        namespace: 'default',
        labels: { app: 'web', env: 'prod', track: 'stable' },
        containers: [
          {
            name: 'web',
            image: 'nginx',
            ports: [{ containerPort: 8080 }]
          }
        ]
      })
    )

    const result = handleExpose(
      apiServer,
      createParsedExpose({
        resource: 'pods',
        name: 'web-prod',
        flags: {
          port: '80',
          name: 'web-svc'
        },
        selector: {
          requirements: [
            { key: 'app', operator: 'Equals', values: ['web'] },
            { key: 'env', operator: 'Equals', values: ['prod'] },
            { key: 'track', operator: 'Equals', values: ['stable'] }
          ]
        }
      })
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toContain('service/web-svc created')
    const serviceResult = apiServer.findResource('Service', 'web-svc', 'default')
    expect(serviceResult.ok).toBe(true)
    if (!serviceResult.ok) {
      return
    }
    expect(serviceResult.value.spec.selector).toEqual({
      app: 'web',
      env: 'prod',
      track: 'stable'
    })
    expect(serviceResult.value.metadata.labels).toEqual({
      app: 'web',
      env: 'prod',
      track: 'stable'
    })
    expect(serviceResult.value.spec.ports[0].port).toBe(80)
    expect(serviceResult.value.spec.ports[0].targetPort).toBe(8080)
  })

  it('should derive selector from pod labels without explicit selector', () => {
    const apiServer = createApiServerFacade()
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'web-prod',
        namespace: 'default',
        labels: { app: 'web', env: 'prod' },
        containers: [{ name: 'web', image: 'nginx', ports: [{ containerPort: 8080 }] }]
      })
    )

    const result = handleExpose(
      apiServer,
      createParsedExpose({
        resource: 'pods',
        name: 'web-prod',
        flags: { port: '80', name: 'web-svc' }
      })
    )

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    const serviceResult = apiServer.findResource('Service', 'web-svc', 'default')
    expect(serviceResult.ok).toBe(true)
    if (!serviceResult.ok) {
      return
    }
    expect(serviceResult.value.spec.selector).toEqual({ app: 'web', env: 'prod' })
    expect(serviceResult.value.metadata.labels).toEqual({ app: 'web', env: 'prod' })
  })

  it('should return not found when pod does not exist and selector is omitted', () => {
    const apiServer = createApiServerFacade()
    const result = handleExpose(
      apiServer,
      createParsedExpose({
        resource: 'pods',
        name: 'missing',
        flags: { port: '80', name: 'web-svc' }
      })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('pods "missing" not found')
    }
  })

  it('should return not found when pod does not exist and selector is provided', () => {
    const apiServer = createApiServerFacade()
    const result = handleExpose(
      apiServer,
      createParsedExpose({
        resource: 'pods',
        name: 'missing',
        flags: { port: '80', name: 'web-svc' },
        selector: {
          requirements: [{ key: 'app', operator: 'Equals', values: ['web'] }]
        }
      })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('pods "missing" not found')
    }
  })
})
