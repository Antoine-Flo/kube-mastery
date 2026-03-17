import { createEventBus, type EventBus } from '../cluster/events/EventBus'
import {
  createConfigMapCreatedEvent,
  createConfigMapDeletedEvent,
  createConfigMapUpdatedEvent,
  createDaemonSetCreatedEvent,
  createDaemonSetDeletedEvent,
  createDaemonSetUpdatedEvent,
  createDeploymentCreatedEvent,
  createDeploymentDeletedEvent,
  createDeploymentUpdatedEvent,
  createIngressCreatedEvent,
  createIngressDeletedEvent,
  createIngressUpdatedEvent,
  createNamespaceCreatedEvent,
  createNamespaceDeletedEvent,
  createNamespaceUpdatedEvent,
  createNodeCreatedEvent,
  createNodeDeletedEvent,
  createNodeUpdatedEvent,
  createPersistentVolumeClaimCreatedEvent,
  createPersistentVolumeClaimUpdatedEvent,
  createPersistentVolumeClaimDeletedEvent,
  createPersistentVolumeCreatedEvent,
  createPersistentVolumeUpdatedEvent,
  createPersistentVolumeDeletedEvent,
  createPodCreatedEvent,
  createPodUpdatedEvent,
  createPodDeletedEvent,
  createReplicaSetCreatedEvent,
  createReplicaSetDeletedEvent,
  createReplicaSetUpdatedEvent,
  createSecretCreatedEvent,
  createSecretDeletedEvent,
  createSecretUpdatedEvent,
  createServiceCreatedEvent,
  createServiceDeletedEvent,
  createServiceUpdatedEvent
} from '../cluster/events/types'
import type {
  KindToResource,
  ResourceKind
} from '../cluster/ClusterState'
import type { ConfigMap } from '../cluster/ressources/ConfigMap'
import type { DaemonSet } from '../cluster/ressources/DaemonSet'
import type { Deployment } from '../cluster/ressources/Deployment'
import type { Ingress } from '../cluster/ressources/Ingress'
import type { Namespace } from '../cluster/ressources/Namespace'
import type { Node } from '../cluster/ressources/Node'
import type { PersistentVolume } from '../cluster/ressources/PersistentVolume'
import type { PersistentVolumeClaim } from '../cluster/ressources/PersistentVolumeClaim'
import type { Pod } from '../cluster/ressources/Pod'
import { computeContainerImageId } from '../cluster/ressources/Pod'
import type { ReplicaSet } from '../cluster/ressources/ReplicaSet'
import type { Secret } from '../cluster/ressources/Secret'
import type { Service } from '../cluster/ressources/Service'
import type {
  BootstrapApiLike,
  ClusterBootstrapConfig
} from '../cluster/systemBootstrap'
import { applyClusterBootstrapViaApi } from '../cluster/systemBootstrap'
import { createEtcdLikeStore, type EtcdLikeStore } from '../etcd/EtcdLikeStore'
import type { AppEvent } from '../events/AppEvent'
import type { Result } from '../shared/result'
import { success, error } from '../shared/result'
import {
  createPodLifecycleEventStore,
  type PodLifecycleEventStore
} from './PodLifecycleEventStore'
import { createWatchHub, type WatchHub } from './WatchHub'

export interface ApiServerFacade {
  readonly eventBus: EventBus
  readonly etcd: EtcdLikeStore
  readonly watchHub: WatchHub
  readonly podLifecycleEventStore: PodLifecycleEventStore
  getEventBus: () => EventBus
  snapshotState: () => ReturnType<EtcdLikeStore['snapshot']>
  findResource: <TKind extends ResourceKind>(
    kind: TKind,
    name: string,
    namespace?: string
  ) => Result<KindToResource<TKind>>
  listResources: <TKind extends ResourceKind>(
    kind: TKind,
    namespace?: string
  ) => KindToResource<TKind>[]
  deleteResource: <TKind extends ResourceKind>(
    kind: TKind,
    name: string,
    namespace?: string
  ) => Result<KindToResource<TKind>>
  createResource: <TKind extends ResourceKind>(
    kind: TKind,
    resource: KindToResource<TKind>,
    namespace?: string
  ) => Result<KindToResource<TKind>>
  updateResource: <TKind extends ResourceKind>(
    kind: TKind,
    name: string,
    resource: KindToResource<TKind>,
    namespace?: string
  ) => Result<KindToResource<TKind>>
  emitEvent: (event: AppEvent) => void
  getResourceVersion: () => string
  stop: () => void
}

export interface CreateApiServerFacadeOptions {
  eventBus?: EventBus
  bootstrap?: ClusterBootstrapConfig
}

const buildPendingPodConditions = (
  pod: Pod,
  transitionTime: string
): Pod['status']['conditions'] => {
  const hasInitContainers = (pod.spec.initContainers?.length ?? 0) > 0
  const isScheduled =
    pod.spec.nodeName != null && pod.spec.nodeName.length > 0
  const observedGeneration = pod.metadata.generation ?? 1
  return [
    {
      type: 'Initialized',
      status: hasInitContainers ? 'False' : 'True',
      lastTransitionTime: transitionTime,
      lastProbeTime: null,
      observedGeneration
    },
    {
      type: 'Ready',
      status: 'False',
      lastTransitionTime: transitionTime,
      lastProbeTime: null,
      observedGeneration
    },
    {
      type: 'ContainersReady',
      status: 'False',
      lastTransitionTime: transitionTime,
      lastProbeTime: null,
      observedGeneration
    },
    {
      type: 'PodScheduled',
      status: isScheduled ? 'True' : 'False',
      lastTransitionTime: transitionTime,
      lastProbeTime: null,
      observedGeneration
    }
  ]
}

const buildContainerImageMap = (
  containers:
    | ReadonlyArray<{ name: string; image: string }>
    | undefined
): Map<string, string> => {
  const imageByName = new Map<string, string>()
  if (containers == null) {
    return imageByName
  }
  for (const container of containers) {
    imageByName.set(container.name, container.image)
  }
  return imageByName
}

const hasContainerImageChanges = (
  previous:
    | ReadonlyArray<{ name: string; image: string }>
    | undefined,
  next:
    | ReadonlyArray<{ name: string; image: string }>
    | undefined
): boolean => {
  const previousByName = buildContainerImageMap(previous)
  const nextByName = buildContainerImageMap(next)
  if (previousByName.size !== nextByName.size) {
    return true
  }
  for (const [name, image] of previousByName.entries()) {
    const nextImage = nextByName.get(name)
    if (nextImage == null || nextImage !== image) {
      return true
    }
  }
  return false
}

const shouldResetPodRuntimeAfterSpecUpdate = (
  previous: Pod,
  next: Pod
): boolean => {
  return (
    hasContainerImageChanges(previous.spec.containers, next.spec.containers) ||
    hasContainerImageChanges(previous.spec.initContainers, next.spec.initContainers)
  )
}

const resetPodToContainerCreating = (
  previous: Pod,
  next: Pod
): Pod => {
  const transitionTime = new Date().toISOString()
  const previousStatuses = previous.status.containerStatuses ?? []
  const previousStatusByName = new Map(
    previousStatuses.map((status) => [status.name, status] as const)
  )

  const initContainerStatuses = (next.spec.initContainers ?? []).map(
    (container) => {
      const previousStatus = previousStatusByName.get(container.name)
      const previousStateDetails =
        previousStatus?.stateDetails ?? {
          state: 'Waiting' as const,
          reason: 'ContainerCreating'
        }
      return {
        ...previousStatus,
        name: container.name,
        image: container.image,
        imageID: computeContainerImageId(container.image),
        ready: false,
        restartCount: previousStatus?.restartCount ?? 0,
        stateDetails: {
          state: 'Waiting' as const,
          reason: 'ContainerCreating'
        },
        lastStateDetails: previousStateDetails,
        started: false,
        startedAt: undefined
      }
    }
  )

  const regularContainerStatuses = next.spec.containers.map((container) => {
    const previousStatus = previousStatusByName.get(container.name)
    const previousStateDetails =
      previousStatus?.stateDetails ?? {
        state: 'Waiting' as const,
        reason: 'ContainerCreating'
      }
    return {
      ...previousStatus,
      name: container.name,
      image: container.image,
      imageID: computeContainerImageId(container.image),
      ready: false,
      restartCount: previousStatus?.restartCount ?? 0,
      stateDetails: {
        state: 'Waiting' as const,
        reason: 'ContainerCreating'
      },
      lastStateDetails: previousStateDetails,
      started: false,
      startedAt: undefined
    }
  })

  const pendingPod: Pod = {
    ...next,
    _simulator: next._simulator ?? previous._simulator,
    status: {
      ...previous.status,
      phase: 'Pending',
      observedGeneration: next.metadata.generation ?? 1,
      conditions: buildPendingPodConditions(next, transitionTime),
      containerStatuses: [...initContainerStatuses, ...regularContainerStatuses]
    }
  }
  return pendingPod
}

const normalizePodUpdateResource = (previous: Pod, next: Pod): Pod => {
  const withSimulator: Pod = {
    ...next,
    _simulator: next._simulator ?? previous._simulator
  }
  if (!shouldResetPodRuntimeAfterSpecUpdate(previous, withSimulator)) {
    return withSimulator
  }
  return resetPodToContainerCreating(previous, withSimulator)
}

export const createApiServerFacade = (
  options: CreateApiServerFacadeOptions = {}
): ApiServerFacade => {
  const eventBus = options.eventBus ?? createEventBus()
  const etcd = createEtcdLikeStore(eventBus)
  const clusterState = {
    findByKind: etcd.findResource,
    listByKind: etcd.listResources,
    toJSON: etcd.snapshot
  }
  const watchHub = createWatchHub(eventBus)
  const podLifecycleEventStore = createPodLifecycleEventStore(etcd)
  const apiServer: ApiServerFacade = {
    eventBus,
    etcd,
    watchHub,
    podLifecycleEventStore,
    getEventBus: () => eventBus,
    snapshotState: () => clusterState.toJSON(),
    findResource: <TKind extends ResourceKind>(
      kind: TKind,
      name: string,
      namespace?: string
    ) => {
      return clusterState.findByKind(kind, name, namespace) as Result<
        KindToResource<TKind>
      >
    },
    listResources: <TKind extends ResourceKind>(
      kind: TKind,
      namespace?: string
    ) => {
      return clusterState.listByKind(kind, namespace) as KindToResource<TKind>[]
    },
    deleteResource: (kind, name, namespace) => {
      const effectiveNamespace = namespace ?? 'default'
      if (kind === 'Pod') {
        const findResult = clusterState.findByKind('Pod', name, effectiveNamespace)
        if (!findResult.ok) {
          return findResult as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createPodDeletedEvent(
            name,
            effectiveNamespace,
            findResult.value as Pod,
            'api-server'
          )
        )
        return findResult as Result<KindToResource<typeof kind>>
      }
      if (kind === 'ConfigMap') {
        const findResult = clusterState.findByKind(
          'ConfigMap',
          name,
          effectiveNamespace
        )
        if (!findResult.ok) {
          return findResult as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createConfigMapDeletedEvent(
            name,
            effectiveNamespace,
            findResult.value as ConfigMap,
            'api-server'
          )
        )
        return findResult as Result<KindToResource<typeof kind>>
      }
      if (kind === 'Secret') {
        const findResult = clusterState.findByKind(
          'Secret',
          name,
          effectiveNamespace
        )
        if (!findResult.ok) {
          return findResult as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createSecretDeletedEvent(
            name,
            effectiveNamespace,
            findResult.value as Secret,
            'api-server'
          )
        )
        return findResult as Result<KindToResource<typeof kind>>
      }
      if (kind === 'PersistentVolume') {
        const findResult = clusterState.findByKind('PersistentVolume', name)
        if (!findResult.ok) {
          return findResult as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createPersistentVolumeDeletedEvent(
            name,
            findResult.value as PersistentVolume,
            'api-server'
          )
        )
        return findResult as Result<KindToResource<typeof kind>>
      }
      if (kind === 'PersistentVolumeClaim') {
        const findResult = clusterState.findByKind(
          'PersistentVolumeClaim',
          name,
          effectiveNamespace
        )
        if (!findResult.ok) {
          return findResult as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createPersistentVolumeClaimDeletedEvent(
            name,
            effectiveNamespace,
            findResult.value as PersistentVolumeClaim,
            'api-server'
          )
        )
        return findResult as Result<KindToResource<typeof kind>>
      }
      if (kind === 'Node') {
        const findResult = clusterState.findByKind('Node', name)
        if (!findResult.ok) {
          return findResult as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createNodeDeletedEvent(name, findResult.value as Node, 'api-server')
        )
        return findResult as Result<KindToResource<typeof kind>>
      }
      if (kind === 'ReplicaSet') {
        const findResult = clusterState.findByKind(
          'ReplicaSet',
          name,
          effectiveNamespace
        )
        if (!findResult.ok) {
          return findResult as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createReplicaSetDeletedEvent(
            name,
            effectiveNamespace,
            findResult.value as ReplicaSet,
            'api-server'
          )
        )
        return findResult as Result<KindToResource<typeof kind>>
      }
      if (kind === 'Deployment') {
        const findResult = clusterState.findByKind(
          'Deployment',
          name,
          effectiveNamespace
        )
        if (!findResult.ok) {
          return findResult as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createDeploymentDeletedEvent(
            name,
            effectiveNamespace,
            findResult.value as Deployment,
            'api-server'
          )
        )
        return findResult as Result<KindToResource<typeof kind>>
      }
      if (kind === 'DaemonSet') {
        const findResult = clusterState.findByKind(
          'DaemonSet',
          name,
          effectiveNamespace
        )
        if (!findResult.ok) {
          return findResult as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createDaemonSetDeletedEvent(
            name,
            effectiveNamespace,
            findResult.value as DaemonSet,
            'api-server'
          )
        )
        return findResult as Result<KindToResource<typeof kind>>
      }
      if (kind === 'Service') {
        const findResult = clusterState.findByKind(
          'Service',
          name,
          effectiveNamespace
        )
        if (!findResult.ok) {
          return findResult as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createServiceDeletedEvent(
            name,
            effectiveNamespace,
            findResult.value as Service,
            'api-server'
          )
        )
        return findResult as Result<KindToResource<typeof kind>>
      }
      if (kind === 'Ingress') {
        const findResult = clusterState.findByKind(
          'Ingress',
          name,
          effectiveNamespace
        )
        if (!findResult.ok) {
          return findResult as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createIngressDeletedEvent(
            name,
            effectiveNamespace,
            findResult.value as Ingress,
            'api-server'
          )
        )
        return findResult as Result<KindToResource<typeof kind>>
      }
      if (kind === 'Namespace') {
        const findResult = clusterState.findByKind('Namespace', name)
        if (!findResult.ok) {
          return findResult as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createNamespaceDeletedEvent(
            name,
            findResult.value as Namespace,
            'api-server'
          )
        )
        return findResult as Result<KindToResource<typeof kind>>
      }
      return error(`Unsupported resource kind: ${kind}`) as Result<
        KindToResource<typeof kind>
      >
    },
    createResource: (kind, resource, namespace) => {
      const effectiveNamespace = namespace ?? resource.metadata.namespace ?? 'default'
      if (kind === 'Pod') {
        etcd.appendEvent(createPodCreatedEvent(resource as Pod, 'api-server'))
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'ConfigMap') {
        etcd.appendEvent(
          createConfigMapCreatedEvent(resource as ConfigMap, 'api-server')
        )
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'Secret') {
        etcd.appendEvent(createSecretCreatedEvent(resource as Secret, 'api-server'))
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'ReplicaSet') {
        etcd.appendEvent(
          createReplicaSetCreatedEvent(resource as ReplicaSet, 'api-server')
        )
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'Deployment') {
        etcd.appendEvent(
          createDeploymentCreatedEvent(resource as Deployment, 'api-server')
        )
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'DaemonSet') {
        etcd.appendEvent(
          createDaemonSetCreatedEvent(resource as DaemonSet, 'api-server')
        )
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'Service') {
        etcd.appendEvent(createServiceCreatedEvent(resource as Service, 'api-server'))
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'PersistentVolume') {
        etcd.appendEvent(
          createPersistentVolumeCreatedEvent(
            resource as PersistentVolume,
            'api-server'
          )
        )
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'PersistentVolumeClaim') {
        etcd.appendEvent(
          createPersistentVolumeClaimCreatedEvent(
            resource as PersistentVolumeClaim,
            'api-server'
          )
        )
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'Node') {
        etcd.appendEvent(createNodeCreatedEvent(resource as Node, 'api-server'))
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'Namespace') {
        etcd.appendEvent(
          createNamespaceCreatedEvent(resource as Namespace, 'api-server')
        )
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'Ingress') {
        etcd.appendEvent(
          createIngressCreatedEvent(resource as Ingress, 'api-server')
        )
        return success(resource as KindToResource<typeof kind>)
      }
      return error(`Unsupported resource kind: ${kind}`) as Result<
        KindToResource<typeof kind>
      >
    },
    updateResource: (kind, name, resource, namespace) => {
      const effectiveNamespace = namespace ?? resource.metadata.namespace ?? 'default'
      if (kind === 'Pod') {
        const previous = clusterState.findByKind('Pod', name, effectiveNamespace)
        if (!previous.ok) {
          return previous as Result<KindToResource<typeof kind>>
        }
        const normalizedPod = normalizePodUpdateResource(
          previous.value as Pod,
          resource as Pod
        )
        etcd.appendEvent(
          createPodUpdatedEvent(
            name,
            effectiveNamespace,
            normalizedPod,
            previous.value as Pod,
            'api-server'
          )
        )
        return success(normalizedPod as KindToResource<typeof kind>)
      }
      if (kind === 'ConfigMap') {
        const previous = clusterState.findByKind('ConfigMap', name, effectiveNamespace)
        if (!previous.ok) {
          return previous as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createConfigMapUpdatedEvent(
            name,
            effectiveNamespace,
            resource as ConfigMap,
            previous.value as ConfigMap,
            'api-server'
          )
        )
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'Secret') {
        const previous = clusterState.findByKind('Secret', name, effectiveNamespace)
        if (!previous.ok) {
          return previous as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createSecretUpdatedEvent(
            name,
            effectiveNamespace,
            resource as Secret,
            previous.value as Secret,
            'api-server'
          )
        )
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'ReplicaSet') {
        const previous = clusterState.findByKind('ReplicaSet', name, effectiveNamespace)
        if (!previous.ok) {
          return previous as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createReplicaSetUpdatedEvent(
            name,
            effectiveNamespace,
            resource as ReplicaSet,
            previous.value as ReplicaSet,
            'api-server'
          )
        )
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'Deployment') {
        const previous = clusterState.findByKind('Deployment', name, effectiveNamespace)
        if (!previous.ok) {
          return previous as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createDeploymentUpdatedEvent(
            name,
            effectiveNamespace,
            resource as Deployment,
            previous.value as Deployment,
            'api-server'
          )
        )
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'DaemonSet') {
        const previous = clusterState.findByKind('DaemonSet', name, effectiveNamespace)
        if (!previous.ok) {
          return previous as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createDaemonSetUpdatedEvent(
            name,
            effectiveNamespace,
            resource as DaemonSet,
            previous.value as DaemonSet,
            'api-server'
          )
        )
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'Service') {
        const previous = clusterState.findByKind('Service', name, effectiveNamespace)
        if (!previous.ok) {
          return previous as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createServiceUpdatedEvent(
            name,
            effectiveNamespace,
            resource as Service,
            previous.value as Service,
            'api-server'
          )
        )
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'PersistentVolume') {
        const previous = clusterState.findByKind('PersistentVolume', name)
        if (!previous.ok) {
          return previous as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createPersistentVolumeUpdatedEvent(
            name,
            resource as PersistentVolume,
            previous.value as PersistentVolume,
            'api-server'
          )
        )
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'PersistentVolumeClaim') {
        const previous = clusterState.findByKind(
          'PersistentVolumeClaim',
          name,
          effectiveNamespace
        )
        if (!previous.ok) {
          return previous as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createPersistentVolumeClaimUpdatedEvent(
            name,
            effectiveNamespace,
            resource as PersistentVolumeClaim,
            previous.value as PersistentVolumeClaim,
            'api-server'
          )
        )
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'Node') {
        const previous = clusterState.findByKind('Node', name)
        if (!previous.ok) {
          return previous as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createNodeUpdatedEvent(
            name,
            resource as Node,
            previous.value as Node,
            'api-server'
          )
        )
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'Namespace') {
        const previous = clusterState.findByKind('Namespace', name)
        if (!previous.ok) {
          return previous as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createNamespaceUpdatedEvent(
            name,
            resource as Namespace,
            previous.value as Namespace,
            'api-server'
          )
        )
        return success(resource as KindToResource<typeof kind>)
      }
      if (kind === 'Ingress') {
        const previous = clusterState.findByKind(
          'Ingress',
          name,
          effectiveNamespace
        )
        if (!previous.ok) {
          return previous as Result<KindToResource<typeof kind>>
        }
        etcd.appendEvent(
          createIngressUpdatedEvent(
            name,
            effectiveNamespace,
            resource as Ingress,
            previous.value as Ingress,
            'api-server'
          )
        )
        return success(resource as KindToResource<typeof kind>)
      }
      return error(`Unsupported resource kind: ${kind}`) as Result<
        KindToResource<typeof kind>
      >
    },
    emitEvent: (event) => {
      etcd.appendEvent(event)
    },
    getResourceVersion: () => etcd.getResourceVersion(),
    stop: () => {
      podLifecycleEventStore.stop()
      etcd.dispose()
    }
  }
  if (options.bootstrap != null) {
    const bootstrapApi: BootstrapApiLike = {
      findResource: (kind, name, namespace) => {
        const targetNamespace = namespace ?? 'default'
        if (kind === 'Node' || kind === 'Namespace') {
          return apiServer.findResource(kind, name) as ReturnType<
            BootstrapApiLike['findResource']
          >
        }
        return apiServer.findResource(kind, name, targetNamespace) as ReturnType<
          BootstrapApiLike['findResource']
        >
      },
      listResources: (kind, namespace) => {
        const targetNamespace = namespace ?? 'default'
        if (kind === 'Node' || kind === 'Namespace') {
          return apiServer.listResources(kind) as ReturnType<
            BootstrapApiLike['listResources']
          >
        }
        return apiServer.listResources(kind, targetNamespace) as ReturnType<
          BootstrapApiLike['listResources']
        >
      },
      createResource: (kind, resource, namespace) => {
        const targetNamespace = namespace ?? resource.metadata.namespace ?? 'default'
        if (kind === 'Node' || kind === 'Namespace') {
          return apiServer.createResource(
            kind,
            resource as KindToResource<typeof kind>
          ) as ReturnType<BootstrapApiLike['createResource']>
        }
        return apiServer.createResource(
          kind,
          resource as KindToResource<typeof kind>,
          targetNamespace
        ) as ReturnType<BootstrapApiLike['createResource']>
      },
      updateResource: (kind, name, resource, namespace) => {
        const targetNamespace = namespace ?? resource.metadata.namespace ?? 'default'
        if (kind === 'Node' || kind === 'Namespace') {
          return apiServer.updateResource(
            kind,
            name,
            resource as KindToResource<typeof kind>
          ) as ReturnType<BootstrapApiLike['updateResource']>
        }
        return apiServer.updateResource(
          kind,
          name,
          resource as KindToResource<typeof kind>,
          targetNamespace
        ) as ReturnType<BootstrapApiLike['updateResource']>
      },
      deleteResource: (kind, name, namespace) => {
        const targetNamespace = namespace ?? 'default'
        if (kind === 'Node' || kind === 'Namespace') {
          return apiServer.deleteResource(kind, name) as ReturnType<
            BootstrapApiLike['deleteResource']
          >
        }
        return apiServer.deleteResource(kind, name, targetNamespace) as ReturnType<
          BootstrapApiLike['deleteResource']
        >
      }
    }
    applyClusterBootstrapViaApi(bootstrapApi, options.bootstrap)
  }
  return apiServer
}
