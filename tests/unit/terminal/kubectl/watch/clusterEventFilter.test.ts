import { describe, expect, it } from 'vitest'
import type { ClusterEvent } from '~/core/cluster/events/types'
import {
  createDeploymentScaledEvent,
  createPodBoundEvent,
  createPodLabeledEvent
} from '~/core/cluster/events/types'
import { createConfigMap } from '~/core/cluster/ressources/ConfigMap'
import { createDaemonSet } from '~/core/cluster/ressources/DaemonSet'
import { createDeployment } from '~/core/cluster/ressources/Deployment'
import { createNetworkPolicy } from '~/core/cluster/ressources/NetworkPolicy'
import { createPersistentVolume } from '~/core/cluster/ressources/PersistentVolume'
import { createPersistentVolumeClaim } from '~/core/cluster/ressources/PersistentVolumeClaim'
import { createPod } from '~/core/cluster/ressources/Pod'
import { createReplicaSet } from '~/core/cluster/ressources/ReplicaSet'
import { createSecret } from '~/core/cluster/ressources/Secret'
import { createService } from '~/core/cluster/ressources/Service'
import type { ParsedCommand } from '~/core/kubectl/commands/types'
import {
  extractMetaFromClusterEvent,
  shouldRenderEvent
} from '~/core/terminal/kubectl/watch/clusterEventFilter'

const EVENT_TS = '2026-01-01T00:00:00.000Z'

const minimalTemplate = () => ({
  spec: {
    containers: [{ name: 'c', image: 'nginx' }]
  }
})

const appSelector = { matchLabels: { app: 'demo' } }

const mkPod = (
  name: string,
  namespace: string,
  labels?: Record<string, string>
) => {
  return createPod({
    name,
    namespace,
    ...(labels != null ? { labels } : {}),
    containers: [{ name: 'c', image: 'nginx' }]
  })
}

const baseParsed = (): ParsedCommand =>
  ({
    action: 'get',
    resource: 'pods',
    flags: { watch: true },
    rawTokens: [],
    rawPath: undefined
  }) as ParsedCommand

describe('extractMetaFromClusterEvent', () => {
  it('returns pod identity and labels for PodCreated', () => {
    const pod = mkPod('nginx', 'prod', { app: 'web' })
    const event: ClusterEvent = {
      type: 'PodCreated',
      timestamp: EVENT_TS,
      payload: { pod }
    }
    expect(extractMetaFromClusterEvent(event, 'pods')).toEqual({
      name: 'nginx',
      namespace: 'prod',
      labels: { app: 'web' }
    })
  })

  it('uses deleted object metadata for PodDeleted', () => {
    const deletedPod = mkPod('gone', 'default', { app: 'db' })
    const event: ClusterEvent = {
      type: 'PodDeleted',
      timestamp: EVENT_TS,
      payload: {
        name: 'gone',
        namespace: 'default',
        deletedPod
      }
    }
    expect(extractMetaFromClusterEvent(event, 'pods')).toEqual({
      name: 'gone',
      namespace: 'default',
      labels: { app: 'db' }
    })
  })

  it('uses current pod labels for PodUpdated', () => {
    const previousPod = mkPod('p', 'default', { version: '1' })
    const pod = mkPod('p', 'default', { version: '2' })
    const event: ClusterEvent = {
      type: 'PodUpdated',
      timestamp: EVENT_TS,
      payload: {
        name: 'p',
        namespace: 'default',
        pod,
        previousPod
      }
    }
    expect(extractMetaFromClusterEvent(event, 'pods')?.labels).toEqual({
      version: '2'
    })
  })

  it('uses current pod labels for PodBound', () => {
    const previousPod = mkPod('p', 'default', {})
    const pod = mkPod('p', 'default', { scheduled: 'true' })
    const event = createPodBoundEvent(
      'p',
      'default',
      'node-1',
      pod,
      previousPod,
      'test'
    )
    expect(extractMetaFromClusterEvent(event, 'pods')?.labels).toEqual({
      scheduled: 'true'
    })
  })

  it('maps ConfigMap lifecycle events to name, namespace, labels', () => {
    const cm = createConfigMap({
      name: 'cfg',
      namespace: 'ns1',
      labels: { cfg: 'a' }
    })
    const created: ClusterEvent = {
      type: 'ConfigMapCreated',
      timestamp: EVENT_TS,
      payload: { configMap: cm }
    }
    expect(extractMetaFromClusterEvent(created, 'configmaps')).toEqual({
      name: 'cfg',
      namespace: 'ns1',
      labels: { cfg: 'a' }
    })

    const prev = createConfigMap({
      name: 'cfg',
      namespace: 'ns1',
      labels: { cfg: 'old' }
    })
    const updated: ClusterEvent = {
      type: 'ConfigMapUpdated',
      timestamp: EVENT_TS,
      payload: {
        name: 'cfg',
        namespace: 'ns1',
        configMap: cm,
        previousConfigMap: prev
      }
    }
    expect(extractMetaFromClusterEvent(updated, 'configmaps')?.labels).toEqual({
      cfg: 'a'
    })

    const deleted: ClusterEvent = {
      type: 'ConfigMapDeleted',
      timestamp: EVENT_TS,
      payload: {
        name: 'cfg',
        namespace: 'ns1',
        deletedConfigMap: prev
      }
    }
    expect(extractMetaFromClusterEvent(deleted, 'configmaps')?.labels).toEqual({
      cfg: 'old'
    })
  })

  it('maps Secret lifecycle events', () => {
    const secret = createSecret({
      name: 's',
      namespace: 'default',
      labels: { tier: 'cache' },
      secretType: { type: 'Opaque' },
      data: {}
    })
    const event: ClusterEvent = {
      type: 'SecretCreated',
      timestamp: EVENT_TS,
      payload: { secret }
    }
    expect(extractMetaFromClusterEvent(event, 'secrets')).toEqual({
      name: 's',
      namespace: 'default',
      labels: { tier: 'cache' }
    })
  })

  it('maps Service lifecycle events', () => {
    const service = createService({
      name: 'api',
      namespace: 'default',
      labels: { svc: 'front' },
      ports: [{ port: 80, targetPort: 8080 }]
    })
    const event: ClusterEvent = {
      type: 'ServiceCreated',
      timestamp: EVENT_TS,
      payload: { service }
    }
    expect(extractMetaFromClusterEvent(event, 'services')).toEqual({
      name: 'api',
      namespace: 'default',
      labels: { svc: 'front' }
    })
  })

  it('maps Deployment, ReplicaSet, and DaemonSet lifecycle events', () => {
    const deployment = createDeployment({
      name: 'dep',
      namespace: 'default',
      labels: { d: '1' },
      selector: appSelector,
      template: minimalTemplate()
    })
    const depCreated: ClusterEvent = {
      type: 'DeploymentCreated',
      timestamp: EVENT_TS,
      payload: { deployment }
    }
    expect(extractMetaFromClusterEvent(depCreated, 'deployments')).toEqual({
      name: 'dep',
      namespace: 'default',
      labels: { d: '1' }
    })

    const rs = createReplicaSet({
      name: 'rs-1',
      namespace: 'default',
      labels: { rs: 'x' },
      selector: appSelector,
      template: minimalTemplate()
    })
    const rsEvent: ClusterEvent = {
      type: 'ReplicaSetCreated',
      timestamp: EVENT_TS,
      payload: { replicaSet: rs }
    }
    expect(extractMetaFromClusterEvent(rsEvent, 'replicasets')?.name).toBe(
      'rs-1'
    )

    const ds = createDaemonSet({
      name: 'ag',
      namespace: 'kube-system',
      labels: { k: 'v' },
      selector: appSelector,
      template: minimalTemplate()
    })
    const dsEvent: ClusterEvent = {
      type: 'DaemonSetCreated',
      timestamp: EVENT_TS,
      payload: { daemonSet: ds }
    }
    expect(extractMetaFromClusterEvent(dsEvent, 'daemonsets')).toEqual({
      name: 'ag',
      namespace: 'kube-system',
      labels: { k: 'v' }
    })
  })

  it('maps PersistentVolumeClaim and PersistentVolume with cluster-scoped PV namespace', () => {
    const pvc = createPersistentVolumeClaim({
      name: 'data',
      namespace: 'app',
      labels: { vol: 'yes' },
      spec: {
        accessModes: ['ReadWriteOnce'],
        resources: { requests: { storage: '1Gi' } }
      }
    })
    const pvcEvent: ClusterEvent = {
      type: 'PersistentVolumeClaimCreated',
      timestamp: EVENT_TS,
      payload: { persistentVolumeClaim: pvc }
    }
    expect(
      extractMetaFromClusterEvent(pvcEvent, 'persistentvolumeclaims')
    ).toEqual({
      name: 'data',
      namespace: 'app',
      labels: { vol: 'yes' }
    })

    const pv = createPersistentVolume({
      name: 'pv-1',
      labels: { zone: 'a' },
      spec: {
        capacity: { storage: '10Gi' },
        accessModes: ['ReadWriteOnce']
      }
    })
    const pvEvent: ClusterEvent = {
      type: 'PersistentVolumeCreated',
      timestamp: EVENT_TS,
      payload: { persistentVolume: pv }
    }
    expect(extractMetaFromClusterEvent(pvEvent, 'persistentvolumes')).toEqual({
      name: 'pv-1',
      namespace: '',
      labels: { zone: 'a' }
    })
  })

  it('maps NetworkPolicy lifecycle events', () => {
    const np = createNetworkPolicy({
      name: 'deny',
      namespace: 'default',
      labels: { policy: 'strict' },
      spec: { podSelector: {}, policyTypes: ['Ingress'] }
    })
    const event: ClusterEvent = {
      type: 'NetworkPolicyCreated',
      timestamp: EVENT_TS,
      payload: { networkPolicy: np }
    }
    expect(extractMetaFromClusterEvent(event, 'networkpolicies')).toEqual({
      name: 'deny',
      namespace: 'default',
      labels: { policy: 'strict' }
    })
  })

  it('returns undefined when resource kind does not match event subject', () => {
    const cm = createConfigMap({ name: 'x', namespace: 'default' })
    const event: ClusterEvent = {
      type: 'ConfigMapCreated',
      timestamp: EVENT_TS,
      payload: { configMap: cm }
    }
    expect(extractMetaFromClusterEvent(event, 'pods')).toBeUndefined()
  })
})

describe('shouldRenderEvent (kubectl watch semantics)', () => {
  it('returns false when resource is missing', () => {
    const pod = mkPod('p', 'default')
    const event: ClusterEvent = {
      type: 'PodCreated',
      timestamp: EVENT_TS,
      payload: { pod }
    }
    const parsed = { ...baseParsed(), resource: undefined }
    expect(shouldRenderEvent(event, parsed, 'default')).toBe(false)
  })

  it('ignores event types not part of the watched resource stream', () => {
    const pod = mkPod('p', 'default')
    const prev = mkPod('p', 'default')
    const labeled = createPodLabeledEvent(
      'p',
      'default',
      { app: 'x' },
      pod,
      prev,
      'test'
    )
    const parsed = baseParsed()
    expect(shouldRenderEvent(labeled, parsed, 'default')).toBe(false)
  })

  it('ignores DeploymentScaled for deployment watch (not ADDED/MODIFIED/DELETED)', () => {
    const scaled = createDeploymentScaledEvent(
      'default',
      'dep',
      'rs-1',
      1,
      3,
      'test'
    )
    const parsed = {
      ...baseParsed(),
      resource: 'deployments' as const
    }
    expect(shouldRenderEvent(scaled, parsed, 'default')).toBe(false)
  })

  it('accepts matching pod events for the current namespace like kubectl -n', () => {
    const pod = mkPod('nginx', 'default', { app: 'web' })
    const event: ClusterEvent = {
      type: 'PodCreated',
      timestamp: EVENT_TS,
      payload: { pod }
    }
    const parsed = baseParsed()
    expect(shouldRenderEvent(event, parsed, 'default')).toBe(true)
  })

  it('drops events from other namespaces when a single namespace is effective', () => {
    const pod = mkPod('nginx', 'kube-system', { app: 'web' })
    const event: ClusterEvent = {
      type: 'PodCreated',
      timestamp: EVENT_TS,
      payload: { pod }
    }
    const parsed = baseParsed()
    expect(shouldRenderEvent(event, parsed, 'default')).toBe(false)
  })

  it('shows all namespaces when effective namespace is undefined like kubectl -A', () => {
    const pod = mkPod('nginx', 'kube-system', {})
    const event: ClusterEvent = {
      type: 'PodCreated',
      timestamp: EVENT_TS,
      payload: { pod }
    }
    const parsed = baseParsed()
    expect(shouldRenderEvent(event, parsed, undefined)).toBe(true)
  })

  it('filters by resource name like kubectl get pod nginx -w', () => {
    const pod = mkPod('redis', 'default', {})
    const event: ClusterEvent = {
      type: 'PodCreated',
      timestamp: EVENT_TS,
      payload: { pod }
    }
    const parsed = { ...baseParsed(), name: 'nginx' }
    expect(shouldRenderEvent(event, parsed, 'default')).toBe(false)
  })

  it('filters by multiple names from get pods a b c -w', () => {
    const pod = mkPod('b', 'default', {})
    const event: ClusterEvent = {
      type: 'PodCreated',
      timestamp: EVENT_TS,
      payload: { pod }
    }
    const parsed = { ...baseParsed(), names: ['a', 'c'] }
    expect(shouldRenderEvent(event, parsed, 'default')).toBe(false)
  })

  it('applies -l / --selector semantics on current object labels', () => {
    const pod = mkPod('p', 'default', { app: 'db' })
    const event: ClusterEvent = {
      type: 'PodCreated',
      timestamp: EVENT_TS,
      payload: { pod }
    }
    const parsed = {
      ...baseParsed(),
      selector: { app: 'web' }
    }
    expect(shouldRenderEvent(event, parsed, 'default')).toBe(false)
  })

  it('passes label filter when labels match', () => {
    const pod = mkPod('p', 'default', { app: 'web', tier: 'front' })
    const event: ClusterEvent = {
      type: 'PodCreated',
      timestamp: EVENT_TS,
      payload: { pod }
    }
    const parsed = {
      ...baseParsed(),
      selector: { app: 'web' }
    }
    expect(shouldRenderEvent(event, parsed, 'default')).toBe(true)
  })

  it('for watch -A on all resources, accepts any listed mutation type', () => {
    const pod = mkPod('x', 'other', {})
    const event: ClusterEvent = {
      type: 'PodCreated',
      timestamp: EVENT_TS,
      payload: { pod }
    }
    const parsed = {
      ...baseParsed(),
      resource: 'all' as const
    }
    expect(shouldRenderEvent(event, parsed, undefined)).toBe(true)
  })
})
