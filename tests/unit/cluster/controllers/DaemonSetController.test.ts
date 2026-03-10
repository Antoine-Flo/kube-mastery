import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createEventBus,
  type EventBus
} from '../../../../src/core/cluster/events/EventBus'
import {
  createPodUpdatedEvent,
  type DaemonSetUpdatedEvent
} from '../../../../src/core/cluster/events/types'
import { DaemonSetController } from '../../../../src/core/cluster/controllers/DaemonSetController'
import type {
  ControllerObservation,
  ControllerState
} from '../../../../src/core/cluster/controllers/types'
import { createDaemonSet, type DaemonSet } from '../../../../src/core/cluster/ressources/DaemonSet'
import { createNode, type NodeStatus } from '../../../../src/core/cluster/ressources/Node'
import { createPod, type Pod } from '../../../../src/core/cluster/ressources/Pod'

describe('DaemonSetController', () => {
  let eventBus: EventBus
  let controller: DaemonSetController
  let mockState: {
    daemonSets: DaemonSet[]
    pods: Pod[]
    nodes: ReturnType<typeof createNode>[]
  }
  let getState: () => ControllerState

  const nodeStatus: NodeStatus = {
    nodeInfo: {
      architecture: 'amd64',
      containerRuntimeVersion: 'containerd://1.7.0',
      kernelVersion: '6.1.0',
      kubeletVersion: 'v1.29.0',
      operatingSystem: 'linux',
      osImage: 'Fedora'
    },
    conditions: [{ type: 'Ready', status: 'True' }]
  }

  const createTestDaemonSet = (name: string): DaemonSet => {
    return createDaemonSet({
      name,
      namespace: 'kube-system',
      labels: { app: name },
      selector: { matchLabels: { app: name } },
      template: {
        metadata: { labels: { app: name } },
        spec: {
          containers: [{ name: 'agent', image: 'busybox:latest' }]
        }
      }
    })
  }

  const createOwnedPod = (
    name: string,
    daemonSetName: string,
    nodeName: string,
    phase: Pod['status']['phase']
  ): Pod => {
    return createPod({
      name,
      namespace: 'kube-system',
      nodeName,
      labels: { app: daemonSetName },
      phase,
      containers: [{ name: 'agent', image: 'busybox:latest' }],
      ownerReferences: [
        {
          apiVersion: 'apps/v1',
          kind: 'DaemonSet',
          name: daemonSetName,
          uid: `kube-system-${daemonSetName}`,
          controller: true
        }
      ]
    })
  }

  beforeEach(() => {
    eventBus = createEventBus()
    mockState = {
      daemonSets: [],
      pods: [],
      nodes: []
    }
    getState = (): ControllerState => {
      return {
        getDaemonSets: (namespace?: string) => {
          if (namespace == null) {
            return mockState.daemonSets
          }
          return mockState.daemonSets.filter((daemonSet) => {
            return daemonSet.metadata.namespace === namespace
          })
        },
        findDaemonSet: (name: string, namespace: string) => {
          const daemonSet = mockState.daemonSets.find((entry) => {
            return (
              entry.metadata.name === name &&
              entry.metadata.namespace === namespace
            )
          })
          if (daemonSet == null) {
            return { ok: false }
          }
          return { ok: true, value: daemonSet }
        },
        getPods: (namespace?: string) => {
          if (namespace == null) {
            return mockState.pods
          }
          return mockState.pods.filter((pod) => {
            return pod.metadata.namespace === namespace
          })
        },
        findPod: (name: string, namespace: string) => {
          const pod = mockState.pods.find((entry) => {
            return (
              entry.metadata.name === name && entry.metadata.namespace === namespace
            )
          })
          if (pod == null) {
            return { ok: false }
          }
          return { ok: true, value: pod }
        },
        getNodes: () => mockState.nodes,
        getDeployments: () => [],
        findDeployment: () => ({ ok: false }),
        getReplicaSets: () => [],
        findReplicaSet: () => ({ ok: false }),
        getPersistentVolumes: () => [],
        findPersistentVolume: () => ({ ok: false }),
        getPersistentVolumeClaims: () => [],
        findPersistentVolumeClaim: () => ({ ok: false })
      }
    }
    controller = new DaemonSetController(eventBus, getState)
  })

  it('reconciles numberReady when a managed pod transitions through PodUpdated', async () => {
    const daemonSet = {
      ...createTestDaemonSet('ds-test'),
      status: {
        currentNumberScheduled: 1,
        desiredNumberScheduled: 1,
        numberReady: 0
      }
    }
    const pendingPod = createOwnedPod('ds-test-a', 'ds-test', 'n1', 'Pending')
    mockState.daemonSets = [daemonSet]
    mockState.pods = [pendingPod]
    mockState.nodes = [createNode({ name: 'n1', status: nodeStatus })]

    const readyUpdates: number[] = []
    eventBus.subscribe('DaemonSetUpdated', (event: DaemonSetUpdatedEvent) => {
      readyUpdates.push(event.payload.daemonSet.status.numberReady)
      mockState.daemonSets = [event.payload.daemonSet]
    })

    controller.start()
    const runningPod = createPod({
      name: pendingPod.metadata.name,
      namespace: pendingPod.metadata.namespace,
      nodeName: pendingPod.spec.nodeName,
      labels: pendingPod.metadata.labels,
      phase: 'Running',
      containers: [{ name: 'agent', image: 'busybox:latest' }],
      ownerReferences: pendingPod.metadata.ownerReferences
    })
    mockState.pods = [runningPod]
    eventBus.emit(
      createPodUpdatedEvent(
        runningPod.metadata.name,
        runningPod.metadata.namespace,
        runningPod,
        pendingPod,
        'test'
      )
    )

    await new Promise((resolve) => setTimeout(resolve, 25))
    controller.stop()

    expect(readyUpdates).toContain(1)
  })

  it('heals stale status via periodic resync without new pod events', () => {
    vi.useFakeTimers()
    const daemonSet = {
      ...createTestDaemonSet('ds-test'),
      status: {
        currentNumberScheduled: 1,
        desiredNumberScheduled: 1,
        numberReady: 0
      }
    }
    const runningPod = createOwnedPod('ds-test-a', 'ds-test', 'n1', 'Running')
    mockState.daemonSets = [daemonSet]
    mockState.pods = [runningPod]
    mockState.nodes = [createNode({ name: 'n1', status: nodeStatus })]
    controller = new DaemonSetController(eventBus, getState, {
      resyncIntervalMs: 50
    })

    const updates: number[] = []
    eventBus.subscribe('DaemonSetUpdated', (event: DaemonSetUpdatedEvent) => {
      updates.push(event.payload.daemonSet.status.numberReady)
      mockState.daemonSets = [event.payload.daemonSet]
    })

    controller.start()
    vi.advanceTimersByTime(1)

    mockState.daemonSets = [
      {
        ...mockState.daemonSets[0],
        status: {
          currentNumberScheduled: 1,
          desiredNumberScheduled: 1,
          numberReady: 0
        }
      }
    ]

    vi.advanceTimersByTime(50)
    controller.stop()
    vi.useRealTimers()

    expect(updates.filter((value) => value === 1).length).toBeGreaterThanOrEqual(2)
  })

  it('emits observability events for enqueue, reconcile and skip', async () => {
    const daemonSet = createTestDaemonSet('ds-test')
    const pod = createOwnedPod('ds-test-a', 'ds-test', 'n1', 'Running')
    mockState.daemonSets = [daemonSet]
    mockState.pods = [pod]
    mockState.nodes = [createNode({ name: 'n1', status: nodeStatus })]

    const observations: ControllerObservation[] = []
    controller = new DaemonSetController(eventBus, getState, {
      observer: (observation) => {
        observations.push(observation)
      }
    })
    eventBus.subscribe('DaemonSetUpdated', (event: DaemonSetUpdatedEvent) => {
      mockState.daemonSets = [event.payload.daemonSet]
    })
    controller.start()
    eventBus.emit(
      createPodUpdatedEvent(
        pod.metadata.name,
        pod.metadata.namespace,
        pod,
        pod,
        'test'
      )
    )

    await new Promise((resolve) => setTimeout(resolve, 25))
    controller.stop()

    expect(
      observations.some((entry) => {
        return (
          entry.controller === 'DaemonSetController' &&
          entry.action === 'enqueue' &&
          entry.eventType === 'PodUpdated'
        )
      })
    ).toBe(true)
    expect(
      observations.some((entry) => {
        return (
          entry.controller === 'DaemonSetController' &&
          entry.action === 'reconcile' &&
          entry.key === 'kube-system/ds-test'
        )
      })
    ).toBe(true)
    expect(
      observations.some((entry) => {
        return (
          entry.controller === 'DaemonSetController' &&
          entry.action === 'skip' &&
          entry.reason === 'NoStatusChange'
        )
      })
    ).toBe(true)
  })
})
