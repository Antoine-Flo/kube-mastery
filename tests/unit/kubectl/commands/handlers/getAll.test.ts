import { beforeEach, describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
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

const createParsedGetDeployments = (
  overrides: Partial<ParsedCommand> = {}
): ParsedCommand => {
  return {
    action: 'get',
    resource: 'deployments',
    flags: {},
    ...overrides
  }
}

describe('kubectl get handler - all', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>

  beforeEach(() => {
    apiServer = createApiServerFacade()
  })

  it('should render services table with service-prefixed names', () => {
    const kubernetesService = createService({
      name: 'kubernetes',
      namespace: 'default',
      clusterIP: '10.96.0.1',
      ports: [{ port: 443, protocol: 'TCP' }]
    })
    const state = createClusterStateData({ services: [kubernetesService] })
    const parsed = createParsedGetAll()

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)

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
      selector: { matchLabels: { app: 'web' } },
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

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)

    expect(result).toContain('pod/web')
    expect(result).toContain('service/web-svc')
    expect(result).toContain('deployment.apps/web-deploy')
  })

  it('should return no resources message when no services match', () => {
    const state = createClusterStateData()
    const parsed = createParsedGetAll()

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)

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

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)

    expect(result).toContain('NAMESPACE')
    expect(result).toContain('kube-system')
    expect(result).toContain('pod/web')
    expect(result).toContain('service/web-svc')
  })

  it('should render deployment READY from status readyReplicas', () => {
    const deploymentZero = createDeployment({
      name: 'deploy-zero',
      namespace: 'default',
      replicas: 2,
      selector: { matchLabels: { app: 'deploy-zero' } },
      template: {
        metadata: { labels: { app: 'deploy-zero' } },
        spec: {
          containers: [{ name: 'nginx', image: 'nginx:latest' }]
        }
      },
      status: {
        replicas: 2,
        readyReplicas: 0,
        availableReplicas: 0,
        updatedReplicas: 2
      }
    })
    const deploymentPartial = createDeployment({
      name: 'deploy-partial',
      namespace: 'default',
      replicas: 2,
      selector: { matchLabels: { app: 'deploy-partial' } },
      template: {
        metadata: { labels: { app: 'deploy-partial' } },
        spec: {
          containers: [{ name: 'nginx', image: 'nginx:latest' }]
        }
      },
      status: {
        replicas: 2,
        readyReplicas: 1,
        availableReplicas: 1,
        updatedReplicas: 2
      }
    })
    const deploymentReady = createDeployment({
      name: 'deploy-ready',
      namespace: 'default',
      replicas: 2,
      selector: { matchLabels: { app: 'deploy-ready' } },
      template: {
        metadata: { labels: { app: 'deploy-ready' } },
        spec: {
          containers: [{ name: 'nginx', image: 'nginx:latest' }]
        }
      },
      status: {
        replicas: 2,
        readyReplicas: 2,
        availableReplicas: 2,
        updatedReplicas: 2
      }
    })
    const state = createClusterStateData({
      deployments: [deploymentZero, deploymentPartial, deploymentReady]
    })
    const parsed = createParsedGetDeployments()

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed)

    expect(result).toContain('deploy-zero')
    expect(result).toContain('0/2')
    expect(result).toContain('deploy-partial')
    expect(result).toContain('1/2')
    expect(result).toContain('deploy-ready')
    expect(result).toContain('2/2')
  })

  it('should return structured list for get all -o json', () => {
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
    const state = createClusterStateData({
      pods: [webPod],
      services: [webService]
    })
    const parsed = createParsedGetAll({
      flags: { output: 'json' }
    })

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed, {
      getResourceVersion: () => '77'
    })
    const payload = JSON.parse(result)
    const names = payload.items.map((item: { metadata: { name: string } }) => {
      return item.metadata.name
    })

    expect(payload.apiVersion).toBe('v1')
    expect(payload.kind).toBe('List')
    expect(payload.metadata.resourceVersion).toBe('77')
    expect(names).toContain('web')
    expect(names).toContain('web-svc')
  })

  it('should return empty structured list for get all -o yaml', () => {
    const state = createClusterStateData()
    const parsed = createParsedGetAll({
      flags: { output: 'yaml' }
    })

    apiServer.etcd.restore(state)
    const result = handleGet(apiServer, parsed, {
      getResourceVersion: () => '88'
    })

    expect(result).toContain('apiVersion: v1')
    expect(result).toContain('kind: List')
    expect(result).toContain('resourceVersion: "88"')
    expect(result).toContain('items: []')
  })
})
