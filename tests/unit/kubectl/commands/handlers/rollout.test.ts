import { beforeEach, describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createDaemonSet } from '../../../../../src/core/cluster/ressources/DaemonSet'
import { createDeployment } from '../../../../../src/core/cluster/ressources/Deployment'
import { createReplicaSet } from '../../../../../src/core/cluster/ressources/ReplicaSet'
import { createStatefulSet } from '../../../../../src/core/cluster/ressources/StatefulSet'
import { handleRollout } from '../../../../../src/core/kubectl/commands/handlers/rollout'
import { parseCommand } from '../../../../../src/core/kubectl/commands/parser'

describe('kubectl rollout handler', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>

  beforeEach(() => {
    apiServer = createApiServerFacade()
  })

  it('returns success for completed deployment rollout status', () => {
    apiServer.createResource(
      'Deployment',
      createDeployment({
        name: 'web-app',
        namespace: 'default',
        replicas: 2,
        selector: { matchLabels: { app: 'web-app' } },
        template: {
          metadata: { labels: { app: 'web-app' } },
          spec: {
            containers: [{ name: 'web', image: 'nginx:1.28' }]
          }
        },
        status: {
          observedGeneration: 1,
          replicas: 2,
          readyReplicas: 2,
          updatedReplicas: 2,
          availableReplicas: 2,
          conditions: []
        }
      })
    )

    const parsed = parseCommand('kubectl rollout status deployment/web-app')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleRollout(apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('successfully rolled out')
    }
  })

  it('renders deployment rollout availability progress like kubectl', () => {
    apiServer.createResource(
      'Deployment',
      createDeployment({
        name: 'web-app',
        namespace: 'default',
        replicas: 3,
        selector: { matchLabels: { app: 'web-app' } },
        template: {
          metadata: { labels: { app: 'web-app' } },
          spec: {
            containers: [{ name: 'web', image: 'nginx:1.28' }]
          }
        },
        status: {
          observedGeneration: 2,
          replicas: 3,
          readyReplicas: 1,
          updatedReplicas: 3,
          availableReplicas: 1,
          conditions: []
        }
      })
    )

    const parsed = parseCommand('kubectl rollout status deployment/web-app --watch=false')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleRollout(apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toContain('1 of 3 updated replicas are available')
    }
  })

  it('renders intermediate rollout status steps before success when watching', () => {
    const deployment = createDeployment({
      name: 'web-app',
      namespace: 'default',
      replicas: 3,
      selector: { matchLabels: { app: 'web-app' } },
      template: {
        metadata: { labels: { app: 'web-app' } },
        spec: {
          containers: [{ name: 'web', image: 'nginx:1.28' }]
        }
      },
      status: {
        observedGeneration: 2,
        replicas: 3,
        readyReplicas: 0,
        updatedReplicas: 3,
        availableReplicas: 0,
        conditions: []
      }
    })
    apiServer.createResource('Deployment', deployment)

    const parsed = parseCommand('kubectl rollout status deployment/web-app')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    let currentAvailable = 0
    const result = handleRollout(apiServer, parsed.value, () => {
      if (currentAvailable >= 3) {
        return
      }
      currentAvailable += 1
      const currentResult = apiServer.findResource('Deployment', 'web-app', 'default')
      if (!currentResult.ok) {
        return
      }
      const updatedDeployment = {
        ...currentResult.value,
        status: {
          ...currentResult.value.status,
          availableReplicas: currentAvailable,
          readyReplicas: currentAvailable
        }
      }
      apiServer.updateResource('Deployment', 'web-app', updatedDeployment, 'default')
    })

    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('1 of 3 updated replicas are available')
    expect(result.value).toContain('2 of 3 updated replicas are available')
    expect(result.value).toContain('deployment.apps "web-app" successfully rolled out')
  })

  it('creates rollout history for daemonset using controller revisions', () => {
    apiServer.createResource(
      'DaemonSet',
      createDaemonSet({
        name: 'node-agent',
        namespace: 'default',
        selector: { matchLabels: { app: 'node-agent' } },
        template: {
          metadata: { labels: { app: 'node-agent' } },
          spec: {
            containers: [{ name: 'agent', image: 'busybox:1.36' }]
          }
        }
      })
    )

    const parsed = parseCommand('kubectl rollout history daemonset/node-agent')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleRollout(apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('daemonset.apps/node-agent')
    expect(result.value).toContain('REVISION')

    const revisions = apiServer.listResources('ControllerRevision', 'default')
    expect(revisions.length).toBe(1)
  })

  it('renders deployment rollout history change-cause when present', () => {
    apiServer.createResource(
      'Deployment',
      createDeployment({
        name: 'web-app',
        namespace: 'default',
        replicas: 3,
        selector: { matchLabels: { app: 'web' } },
        template: {
          metadata: { labels: { app: 'web' } },
          spec: {
            containers: [{ name: 'web', image: 'nginx:1.28' }]
          }
        }
      })
    )
    apiServer.createResource(
      'ReplicaSet',
      createReplicaSet({
        name: 'web-app-rs-v1',
        namespace: 'default',
        replicas: 0,
        selector: { matchLabels: { app: 'web', version: 'v1' } },
        template: {
          metadata: { labels: { app: 'web', version: 'v1' } },
          spec: {
            containers: [{ name: 'web', image: 'nginx:1.28' }]
          }
        },
        annotations: {
          'deployment.kubernetes.io/revision': '1',
          'kubernetes.io/change-cause': 'Initial deployment: nginx 1.28'
        },
        ownerReferences: [
          {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            name: 'web-app',
            uid: 'default-web-app',
            controller: true
          }
        ]
      })
    )
    apiServer.createResource(
      'ReplicaSet',
      createReplicaSet({
        name: 'web-app-rs-v2',
        namespace: 'default',
        replicas: 3,
        selector: { matchLabels: { app: 'web', version: 'v2' } },
        template: {
          metadata: { labels: { app: 'web', version: 'v2' } },
          spec: {
            containers: [{ name: 'web', image: 'nginx:1.26' }]
          }
        },
        annotations: {
          'deployment.kubernetes.io/revision': '2',
          'kubernetes.io/change-cause': 'Upgrade to nginx 1.26'
        },
        ownerReferences: [
          {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            name: 'web-app',
            uid: 'default-web-app',
            controller: true
          }
        ]
      })
    )

    const parsed = parseCommand('kubectl rollout history deployment/web-app')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }
    const result = handleRollout(apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('1         Initial deployment: nginx 1.28')
    expect(result.value).toContain('2         Upgrade to nginx 1.26')
  })

  it('renders rollout history revision details in kubectl-like template format', () => {
    apiServer.createResource(
      'Deployment',
      createDeployment({
        name: 'web-app',
        namespace: 'default',
        replicas: 3,
        selector: { matchLabels: { app: 'web' } },
        template: {
          metadata: { labels: { app: 'web' } },
          spec: {
            containers: [{ name: 'web', image: 'nginx:1.26' }]
          }
        }
      })
    )
    apiServer.createResource(
      'ReplicaSet',
      createReplicaSet({
        name: 'web-app-rs-v2',
        namespace: 'default',
        replicas: 3,
        selector: { matchLabels: { app: 'web', version: 'v2' } },
        template: {
          metadata: {
            labels: { app: 'web', 'pod-template-hash': '587db7fb6f' }
          },
          spec: {
            containers: [{ name: 'web', image: 'nginx:1.26' }]
          }
        },
        annotations: {
          'deployment.kubernetes.io/revision': '2'
        },
        ownerReferences: [
          {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            name: 'web-app',
            uid: 'default-web-app',
            controller: true
          }
        ]
      })
    )

    const parsed = parseCommand(
      'kubectl rollout history deployment/web-app --revision=2'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleRollout(apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('Pod Template:')
    expect(result.value).toContain('Labels:       app=web')
    expect(result.value).toContain('pod-template-hash=587db7fb6f')
    expect(result.value).toContain('Containers:')
    expect(result.value).toContain('web:')
    expect(result.value).toContain('Image:      nginx:1.26')
    expect(result.value).not.toContain('{')
  })

  it('restarts and undoes a statefulset rollout', () => {
    apiServer.createResource(
      'StatefulSet',
      createStatefulSet({
        name: 'db',
        namespace: 'default',
        replicas: 2,
        selector: { matchLabels: { app: 'db' } },
        serviceName: 'db',
        template: {
          metadata: { labels: { app: 'db' } },
          spec: {
            containers: [{ name: 'db', image: 'postgres:16' }]
          }
        }
      })
    )

    const restartParsed = parseCommand('kubectl rollout restart statefulset/db')
    expect(restartParsed.ok).toBe(true)
    if (!restartParsed.ok) {
      return
    }

    const restartResult = handleRollout(apiServer, restartParsed.value)
    expect(restartResult.ok).toBe(true)
    if (!restartResult.ok) {
      return
    }
    expect(restartResult.value).toContain('statefulset.apps/db restarted')

    const undoParsed = parseCommand('kubectl rollout undo statefulset/db')
    expect(undoParsed.ok).toBe(true)
    if (!undoParsed.ok) {
      return
    }

    const undoResult = handleRollout(apiServer, undoParsed.value)
    expect(undoResult.ok).toBe(true)
    if (!undoResult.ok) {
      return
    }
    expect(undoResult.value).toContain('statefulset.apps/db rolled back')
  })

  it('undoes deployment to explicit revision with --to-revision', () => {
    apiServer.createResource(
      'Deployment',
      createDeployment({
        name: 'web-app',
        namespace: 'default',
        replicas: 3,
        selector: { matchLabels: { app: 'web' } },
        template: {
          metadata: { labels: { app: 'web' } },
          spec: {
            containers: [{ name: 'web', image: 'nginx:broken' }]
          }
        }
      })
    )
    apiServer.createResource(
      'ReplicaSet',
      createReplicaSet({
        name: 'web-app-rs-v1',
        namespace: 'default',
        replicas: 0,
        selector: { matchLabels: { app: 'web', version: 'v1' } },
        template: {
          metadata: { labels: { app: 'web', version: 'v1' } },
          spec: {
            containers: [{ name: 'web', image: 'nginx:1.26' }]
          }
        },
        annotations: {
          'deployment.kubernetes.io/revision': '1'
        },
        ownerReferences: [
          {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            name: 'web-app',
            uid: 'default-web-app',
            controller: true
          }
        ]
      })
    )
    apiServer.createResource(
      'ReplicaSet',
      createReplicaSet({
        name: 'web-app-rs-v2',
        namespace: 'default',
        replicas: 3,
        selector: { matchLabels: { app: 'web', version: 'v2' } },
        template: {
          metadata: { labels: { app: 'web', version: 'v2' } },
          spec: {
            containers: [{ name: 'web', image: 'nginx:broken' }]
          }
        },
        annotations: {
          'deployment.kubernetes.io/revision': '2'
        },
        ownerReferences: [
          {
            apiVersion: 'apps/v1',
            kind: 'Deployment',
            name: 'web-app',
            uid: 'default-web-app',
            controller: true
          }
        ]
      })
    )

    const undoParsed = parseCommand(
      'kubectl rollout undo deployment/web-app --to-revision=1'
    )
    expect(undoParsed.ok).toBe(true)
    if (!undoParsed.ok) {
      return
    }

    const undoResult = handleRollout(apiServer, undoParsed.value)
    expect(undoResult.ok).toBe(true)
    if (!undoResult.ok) {
      return
    }
    expect(undoResult.value).toContain('deployment.apps/web-app rolled back')

    const deploymentResult = apiServer.findResource(
      'Deployment',
      'web-app',
      'default'
    )
    expect(deploymentResult.ok).toBe(true)
    if (!deploymentResult.ok) {
      return
    }
    expect(
      deploymentResult.value.spec.template.spec.containers[0]?.image
    ).toBe('nginx:1.26')
  })
})
