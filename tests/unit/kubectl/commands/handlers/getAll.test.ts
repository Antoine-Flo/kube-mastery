import { describe, expect, it } from 'vitest'
import { createDeployment } from '../../../../../src/core/cluster/ressources/Deployment'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { createService } from '../../../../../src/core/cluster/ressources/Service'
import { handleGet } from '../../../../../src/core/kubectl/commands/handlers/get'
import type { ParsedCommand } from '../../../../../src/core/kubectl/commands/types'
import { createClusterStateData } from '../../../helpers/utils'

const createParsedGetAll = (
  overrides: Partial<ParsedCommand> = {}
): ParsedCommand => {
  return {
    action: 'get',
    resource: 'all',
    flags: {},
    ...overrides
  }
}

describe('kubectl get handler - all', () => {
  it('should render services table with service-prefixed names', () => {
    const kubernetesService = createService({
      name: 'kubernetes',
      namespace: 'default',
      clusterIP: '10.96.0.1',
      ports: [{ port: 443, protocol: 'TCP' }]
    })
    const state = createClusterStateData({ services: [kubernetesService] })
    const parsed = createParsedGetAll()

    const result = handleGet(state, parsed)

    expect(result).toContain('NAME')
    expect(result).toContain('TYPE')
    expect(result).toContain('CLUSTER-IP')
    expect(result).toContain('EXTERNAL-IP')
    expect(result).toContain('PORT(S)')
    expect(result).toContain('AGE')
    expect(result).toContain('service/kubernetes')
    expect(result).toContain('10.96.0.1')
    expect(result).toContain('443/TCP')
  })

  it('should aggregate multiple resource sections', () => {
    const webPod = createPod({
      name: 'web',
      namespace: 'default',
      containers: [{ name: 'nginx', image: 'nginx:latest' }]
    })
    const webService = createService({
      name: 'web-svc',
      namespace: 'default',
      clusterIP: '10.96.10.10',
      ports: [{ port: 80, protocol: 'TCP' }]
    })
    const webDeployment = createDeployment({
      name: 'web-deploy',
      namespace: 'default',
      selector: { app: 'web' },
      template: {
        metadata: { labels: { app: 'web' } },
        spec: {
          containers: [{ name: 'nginx', image: 'nginx:latest' }]
        }
      }
    })
    const state = createClusterStateData({
      pods: [webPod],
      services: [webService],
      deployments: [webDeployment]
    })
    const parsed = createParsedGetAll()

    const result = handleGet(state, parsed)

    expect(result).toContain('pod/web')
    expect(result).toContain('service/web-svc')
    expect(result).toContain('deployment.apps/web-deploy')
  })

  it('should return no resources message when no services match', () => {
    const state = createClusterStateData()
    const parsed = createParsedGetAll()

    const result = handleGet(state, parsed)

    expect(result).toBe('No resources found in default namespace.')
  })

  it('should include namespace column with --all-namespaces', () => {
    const webPod = createPod({
      name: 'web',
      namespace: 'kube-system',
      containers: [{ name: 'nginx', image: 'nginx:latest' }]
    })
    const webService = createService({
      name: 'web-svc',
      namespace: 'kube-system',
      clusterIP: '10.96.10.10',
      ports: [{ port: 80, protocol: 'TCP' }]
    })
    const state = createClusterStateData({
      pods: [webPod],
      services: [webService]
    })
    const parsed = createParsedGetAll({
      flags: { 'all-namespaces': true, A: true }
    })

    const result = handleGet(state, parsed)

    expect(result).toContain('NAMESPACE')
    expect(result).toContain('kube-system')
    expect(result).toContain('pod/web')
    expect(result).toContain('service/web-svc')
  })
})
