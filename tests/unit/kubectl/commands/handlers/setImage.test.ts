import { beforeEach, describe, expect, it } from 'vitest'
import { createApiServerFacade } from '../../../../../src/core/api/ApiServerFacade'
import { createDaemonSet } from '../../../../../src/core/cluster/ressources/DaemonSet'
import { createDeployment } from '../../../../../src/core/cluster/ressources/Deployment'
import { createPod } from '../../../../../src/core/cluster/ressources/Pod'
import { createReplicaSet } from '../../../../../src/core/cluster/ressources/ReplicaSet'
import { handleSetImage } from '../../../../../src/core/kubectl/commands/handlers/setImage'
import { parseCommand } from '../../../../../src/core/kubectl/commands/parser'

describe('kubectl set image handler', () => {
  let apiServer: ReturnType<typeof createApiServerFacade>

  beforeEach(() => {
    apiServer = createApiServerFacade()
  })

  it('should update pod container image', () => {
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'my-pod',
        namespace: 'default',
        phase: 'Running',
        containers: [{ name: 'web', image: 'nginx:1.25' }]
      })
    )

    const parsed = parseCommand('kubectl set image pod/my-pod web=nginx:1.26')
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleSetImage(apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('pod/my-pod image updated')

    const pod = apiServer.findResource('Pod', 'my-pod', 'default')
    expect(pod.ok).toBe(true)
    if (!pod.ok) {
      return
    }
    expect(pod.value.spec.containers[0].image).toBe('nginx:1.26')
    expect(pod.value.status.phase).toBe('Pending')
    expect(pod.value.status.containerStatuses?.[0]?.stateDetails?.state).toBe(
      'Waiting'
    )
    expect(pod.value.status.containerStatuses?.[0]?.stateDetails?.reason).toBe(
      'ContainerCreating'
    )
  })

  it('should update deployment template container image', () => {
    apiServer.createResource(
      'Deployment',
      createDeployment({
        name: 'my-deploy',
        namespace: 'default',
        selector: { matchLabels: { app: 'my-deploy' } },
        template: {
          metadata: { labels: { app: 'my-deploy' } },
          spec: {
            containers: [{ name: 'app', image: 'nginx:1.25' }]
          }
        }
      })
    )

    const parsed = parseCommand(
      'kubectl set image deployment/my-deploy app=nginx:1.26'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleSetImage(apiServer, parsed.value)
    expect(result.ok).toBe(true)
    if (!result.ok) {
      return
    }
    expect(result.value).toContain('deployment.apps/my-deploy image updated')
  })

  it('should update replicaset and daemonset container images', () => {
    apiServer.createResource(
      'ReplicaSet',
      createReplicaSet({
        name: 'my-rs',
        namespace: 'default',
        selector: { matchLabels: { app: 'my-rs' } },
        template: {
          metadata: { labels: { app: 'my-rs' } },
          spec: {
            containers: [{ name: 'app', image: 'nginx:1.25' }]
          }
        }
      })
    )
    apiServer.createResource(
      'DaemonSet',
      createDaemonSet({
        name: 'my-ds',
        namespace: 'default',
        selector: { matchLabels: { app: 'my-ds' } },
        template: {
          metadata: { labels: { app: 'my-ds' } },
          spec: {
            containers: [{ name: 'agent', image: 'busybox:1.35' }]
          }
        }
      })
    )

    const rsParsed = parseCommand(
      'kubectl set image replicaset/my-rs app=nginx:1.26'
    )
    expect(rsParsed.ok).toBe(true)
    if (rsParsed.ok) {
      const rsResult = handleSetImage(apiServer, rsParsed.value)
      expect(rsResult.ok).toBe(true)
      if (rsResult.ok) {
        expect(rsResult.value).toContain('replicaset.apps/my-rs image updated')
      }
    }

    const dsParsed = parseCommand(
      'kubectl set image daemonset/my-ds agent=busybox:1.36'
    )
    expect(dsParsed.ok).toBe(true)
    if (dsParsed.ok) {
      const dsResult = handleSetImage(apiServer, dsParsed.value)
      expect(dsResult.ok).toBe(true)
      if (dsResult.ok) {
        expect(dsResult.value).toContain('daemonset.apps/my-ds image updated')
      }
    }
  })

  it('should return not found when target resource does not exist', () => {
    const parsed = parseCommand(
      'kubectl set image pod/not-there web=nginx:1.26'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleSetImage(apiServer, parsed.value)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('pods "not-there" not found')
    }
  })

  it('should return error when container name does not exist on target', () => {
    apiServer.createResource(
      'Pod',
      createPod({
        name: 'my-pod',
        namespace: 'default',
        containers: [{ name: 'web', image: 'nginx:1.25' }]
      })
    )

    const parsed = parseCommand(
      'kubectl set image pod/my-pod sidecar=busybox:1.36'
    )
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) {
      return
    }

    const result = handleSetImage(apiServer, parsed.value)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain('unable to find container named "sidecar"')
    }
  })
})
