import { beforeEach, describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createDaemonSet } from '../../../../../src/core/cluster/ressources/DaemonSet'
import { createDeployment } from '../../../../../src/core/cluster/ressources/Deployment'
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
    expect(result.value).toContain('daemonset.apps/node-agent rollout history')
    expect(result.value).toContain('REVISION')

    const revisions = apiServer.listResources('ControllerRevision', 'default')
    expect(revisions.length).toBe(1)
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
})
