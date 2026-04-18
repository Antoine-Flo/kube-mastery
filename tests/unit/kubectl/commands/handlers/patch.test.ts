import { beforeEach, describe, expect, it } from 'vitest'
import {
  createApiServerFacade,
  type ApiServerFacade
} from '../../../../../src/core/api/ApiServerFacade'
import { createDaemonSet } from '../../../../../src/core/cluster/ressources/DaemonSet'
import { createDeployment } from '../../../../../src/core/cluster/ressources/Deployment'
import { createNamespace } from '../../../../../src/core/cluster/ressources/Namespace'
import { createStatefulSet } from '../../../../../src/core/cluster/ressources/StatefulSet'
import { handlePatch } from '../../../../../src/core/kubectl/commands/handlers/patch'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'

describe('kubectl patch handler', () => {
  let apiServer: ApiServerFacade

  beforeEach(() => {
    apiServer = createApiServerFacade()
  })

  const createParsed = (
    overrides: Partial<ParsedCommand> = {}
  ): ParsedCommand => {
    return {
      action: 'patch',
      resource: 'deployments',
      name: 'my-app',
      flags: {
        type: 'merge',
        patch: '{"spec":{"replicas":4}}'
      },
      patchType: 'merge',
      patchPayload: '{"spec":{"replicas":4}}',
      ...overrides
    }
  }

  const createWorkloadTemplate = () => {
    return {
      metadata: { labels: { app: 'my-app' } },
      spec: { containers: [{ name: 'app', image: 'nginx:1.28' }] }
    }
  }

  it('should patch deployment replicas with merge patch', () => {
    apiServer.createResource(
      'Deployment',
      createDeployment({
        name: 'my-app',
        namespace: 'default',
        replicas: 2,
        selector: { matchLabels: { app: 'my-app' } },
        template: createWorkloadTemplate()
      })
    )

    const result = handlePatch(
      apiServer,
      createParsed({ patchPayload: '{"spec":{"replicas":4}}' })
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    expect(result.value).toBe('deployment.apps/my-app patched')
    const deployment = apiServer.findResource('Deployment', 'my-app', 'default')
    expect(deployment.ok).toBe(true)
    if (!deployment.ok) {
      return
    }
    expect(deployment.value.spec.replicas).toBe(4)
  })

  it('should patch daemonset image with merge patch', () => {
    apiServer.createResource(
      'DaemonSet',
      createDaemonSet({
        name: 'my-daemonset',
        namespace: 'default',
        selector: { matchLabels: { app: 'my-app' } },
        template: createWorkloadTemplate()
      })
    )

    const result = handlePatch(
      apiServer,
      createParsed({
        resource: 'daemonsets',
        name: 'my-daemonset',
        patchPayload:
          '{"spec":{"template":{"spec":{"containers":[{"name":"app","image":"nginx:1.29"}]}}}}',
        flags: {
          type: 'merge',
          patch:
            '{"spec":{"template":{"spec":{"containers":[{"name":"app","image":"nginx:1.29"}]}}}}'
        }
      })
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    const daemonSet = apiServer.findResource(
      'DaemonSet',
      'my-daemonset',
      'default'
    )
    expect(daemonSet.ok).toBe(true)
    if (!daemonSet.ok) {
      return
    }
    expect(daemonSet.value.spec.template.spec.containers[0].image).toBe(
      'nginx:1.29'
    )
  })

  it('should patch statefulset replicas with merge patch', () => {
    apiServer.createResource(
      'Namespace',
      createNamespace({
        name: 'tools'
      })
    )
    apiServer.createResource(
      'StatefulSet',
      createStatefulSet({
        name: 'my-sts',
        namespace: 'tools',
        replicas: 1,
        selector: { matchLabels: { app: 'my-app' } },
        serviceName: 'my-sts',
        template: createWorkloadTemplate()
      }),
      'tools'
    )

    const result = handlePatch(
      apiServer,
      createParsed({
        resource: 'statefulsets',
        name: 'my-sts',
        namespace: 'tools',
        patchPayload: '{"spec":{"replicas":3}}',
        flags: {
          type: 'merge',
          patch: '{"spec":{"replicas":3}}'
        }
      })
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }

    const statefulSet = apiServer.findResource('StatefulSet', 'my-sts', 'tools')
    expect(statefulSet.ok).toBe(true)
    if (!statefulSet.ok) {
      return
    }
    expect(statefulSet.value.spec.replicas).toBe(3)
  })

  it('should reject unsupported patch type', () => {
    const result = handlePatch(
      apiServer,
      createParsed({
        flags: {
          type: 'json',
          patch: '{"spec":{"replicas":4}}'
        }
      })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('--type must be "merge"')
    }
  })

  it('should reject invalid json payload', () => {
    const result = handlePatch(
      apiServer,
      createParsed({
        patchPayload: '{"spec":{"replicas":4}',
        flags: {
          type: 'merge',
          patch: '{"spec":{"replicas":4}'
        }
      })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('invalid JSON patch')
    }
  })

  it('should return not found when target resource does not exist', () => {
    const result = handlePatch(apiServer, createParsed())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Error from server (NotFound)')
      expect(result.error).toContain('deployments.apps "my-app" not found')
    }
  })

  it('should reject immutable selector changes', () => {
    apiServer.createResource(
      'Deployment',
      createDeployment({
        name: 'my-app',
        namespace: 'default',
        replicas: 1,
        selector: { matchLabels: { app: 'my-app' } },
        template: createWorkloadTemplate()
      })
    )

    const result = handlePatch(
      apiServer,
      createParsed({
        patchPayload: '{"spec":{"selector":{"matchLabels":{"app":"other"}}}}',
        flags: {
          type: 'merge',
          patch: '{"spec":{"selector":{"matchLabels":{"app":"other"}}}}'
        }
      })
    )
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('Error from server (Invalid)')
      expect(result.error).toContain('field is immutable')
    }
  })

  it('should not mutate deployment on patch --dry-run=client', () => {
    apiServer.createResource(
      'Deployment',
      createDeployment({
        name: 'dry-run-patch',
        namespace: 'default',
        replicas: 2,
        selector: { matchLabels: { app: 'dry-run-patch' } },
        template: {
          metadata: { labels: { app: 'dry-run-patch' } },
          spec: { containers: [{ name: 'app', image: 'nginx:1.28' }] }
        }
      })
    )

    const result = handlePatch(
      apiServer,
      createParsed({
        name: 'dry-run-patch',
        patchPayload: '{"spec":{"replicas":7}}',
        flags: {
          type: 'merge',
          patch: '{"spec":{"replicas":7}}',
          'dry-run': 'client'
        }
      })
    )
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('(dry run)')

    const deployment = apiServer.findResource(
      'Deployment',
      'dry-run-patch',
      'default'
    )
    expect(deployment.ok).toBe(true)
    if (!deployment.ok) {
      return
    }
    expect(deployment.value.spec.replicas).toBe(2)
  })
})
