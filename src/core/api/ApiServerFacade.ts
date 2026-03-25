import { createEventBus, type EventBus } from '../cluster/events/EventBus'
import {
  createConfigMapCreatedEvent,
  createConfigMapDeletedEvent,
  createConfigMapUpdatedEvent,
  createControllerRevisionCreatedEvent,
  createControllerRevisionDeletedEvent,
  createControllerRevisionUpdatedEvent,
  createDaemonSetCreatedEvent,
  createDaemonSetDeletedEvent,
  createDaemonSetUpdatedEvent,
  createDeploymentCreatedEvent,
  createDeploymentDeletedEvent,
  createDeploymentUpdatedEvent,
  createEndpointSliceCreatedEvent,
  createEndpointSliceDeletedEvent,
  createEndpointSliceUpdatedEvent,
  createEndpointsCreatedEvent,
  createEndpointsDeletedEvent,
  createEndpointsUpdatedEvent,
  createIngressCreatedEvent,
  createIngressDeletedEvent,
  createIngressUpdatedEvent,
  createLeaseCreatedEvent,
  createLeaseDeletedEvent,
  createLeaseUpdatedEvent,
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
  createServiceUpdatedEvent,
  createStatefulSetCreatedEvent,
  createStatefulSetDeletedEvent,
  createStatefulSetUpdatedEvent
} from '../cluster/events/types'
import type { KindToResource, ResourceKind } from '../cluster/ClusterState'
import type { ConfigMap } from '../cluster/ressources/ConfigMap'
import type { ControllerRevision } from '../cluster/ressources/ControllerRevision'
import type { DaemonSet } from '../cluster/ressources/DaemonSet'
import type { Deployment } from '../cluster/ressources/Deployment'
import type { EndpointSlice } from '../cluster/ressources/EndpointSlice'
import type { Endpoints } from '../cluster/ressources/Endpoints'
import type { Ingress } from '../cluster/ressources/Ingress'
import type { Lease } from '../cluster/ressources/Lease'
import type { Namespace } from '../cluster/ressources/Namespace'
import type { Node } from '../cluster/ressources/Node'
import type { PersistentVolume } from '../cluster/ressources/PersistentVolume'
import type { PersistentVolumeClaim } from '../cluster/ressources/PersistentVolumeClaim'
import type { Pod } from '../cluster/ressources/Pod'
import { computeContainerImageId } from '../cluster/ressources/Pod'
import type { ReplicaSet } from '../cluster/ressources/ReplicaSet'
import type { Secret } from '../cluster/ressources/Secret'
import type { Service } from '../cluster/ressources/Service'
import type { StatefulSet } from '../cluster/ressources/StatefulSet'
import type {
  BootstrapApiLike,
  ClusterBootstrapConfig
} from '../cluster/systemBootstrap'
import { applyClusterBootstrapViaApi } from '../cluster/systemBootstrap'
import { createEtcdLikeStore, type EtcdLikeStore } from '../etcd/EtcdLikeStore'
import type { AppEvent } from '../events/AppEvent'
import type { Result } from '../shared/result'
import { success } from '../shared/result'
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
    namespace?: string,
    options?: {
      gracePeriodSeconds?: number
      force?: boolean
    }
  ) => Result<KindToResource<TKind>>
  requestPodDeletion: (
    name: string,
    namespace?: string,
    options?: {
      gracePeriodSeconds?: number
      force?: boolean
      source?: string
    }
  ) => Result<Pod>
  finalizePodDeletion: (
    name: string,
    namespace?: string,
    options?: { source?: string }
  ) => Result<Pod>
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

const DEFAULT_POD_DELETION_GRACE_PERIOD_SECONDS = 30

const buildPendingPodConditions = (
  pod: Pod,
  transitionTime: string
): Pod['status']['conditions'] => {
  const hasInitContainers = (pod.spec.initContainers?.length ?? 0) > 0
  const isScheduled = pod.spec.nodeName != null && pod.spec.nodeName.length > 0
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
  containers: ReadonlyArray<{ name: string; image: string }> | undefined
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
  previous: ReadonlyArray<{ name: string; image: string }> | undefined,
  next: ReadonlyArray<{ name: string; image: string }> | undefined
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

const normalizeDeletionGracePeriodSeconds = (
  gracePeriodSeconds: number | undefined
): number => {
  if (gracePeriodSeconds == null) {
    return DEFAULT_POD_DELETION_GRACE_PERIOD_SECONDS
  }
  if (!Number.isFinite(gracePeriodSeconds)) {
    return DEFAULT_POD_DELETION_GRACE_PERIOD_SECONDS
  }
  const normalized = Math.floor(gracePeriodSeconds)
  if (normalized < 0) {
    return DEFAULT_POD_DELETION_GRACE_PERIOD_SECONDS
  }
  return normalized
}

const withTerminatingPodConditions = (
  pod: Pod,
  transitionTime: string
): Pod => {
  const nextConditions = (pod.status.conditions ?? []).map((condition) => {
    if (condition.type === 'Ready' || condition.type === 'ContainersReady') {
      if (condition.status === 'False') {
        return condition
      }
      return {
        ...condition,
        status: 'False' as const,
        lastTransitionTime: transitionTime
      }
    }
    return condition
  })
  return {
    ...pod,
    status: {
      ...pod.status,
      conditions: nextConditions
    }
  }
}

const shouldResetPodRuntimeAfterSpecUpdate = (
  previous: Pod,
  next: Pod
): boolean => {
  return (
    hasContainerImageChanges(previous.spec.containers, next.spec.containers) ||
    hasContainerImageChanges(
      previous.spec.initContainers,
      next.spec.initContainers
    )
  )
}

const resetPodToContainerCreating = (previous: Pod, next: Pod): Pod => {
  const transitionTime = new Date().toISOString()
  const previousStatuses = previous.status.containerStatuses ?? []
  const previousStatusByName = new Map(
    previousStatuses.map((status) => [status.name, status] as const)
  )

  const initContainerStatuses = (next.spec.initContainers ?? []).map(
    (container) => {
      const previousStatus = previousStatusByName.get(container.name)
      const previousStateDetails = previousStatus?.stateDetails ?? {
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
    const previousStateDetails = previousStatus?.stateDetails ?? {
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

interface ResourceMutationEventFactory {
  create: (resource: KindToResource<ResourceKind>, source: string) => AppEvent
  update: (
    name: string,
    namespace: string | undefined,
    resource: KindToResource<ResourceKind>,
    previous: KindToResource<ResourceKind>,
    source: string
  ) => AppEvent
  delete: (
    name: string,
    namespace: string | undefined,
    resource: KindToResource<ResourceKind>,
    source: string
  ) => AppEvent
}

const createNamespacedMutationEvents = <TResource>(
  createEvent: (resource: TResource, source: string) => AppEvent,
  updateEvent: (
    name: string,
    namespace: string,
    resource: TResource,
    previous: TResource,
    source: string
  ) => AppEvent,
  deleteEvent: (
    name: string,
    namespace: string,
    resource: TResource,
    source: string
  ) => AppEvent
): ResourceMutationEventFactory => {
  return {
    create: (resource, source) => {
      return createEvent(resource as TResource, source)
    },
    update: (name, namespace, resource, previous, source) => {
      const targetNamespace = namespace ?? 'default'
      return updateEvent(
        name,
        targetNamespace,
        resource as TResource,
        previous as TResource,
        source
      )
    },
    delete: (name, namespace, resource, source) => {
      const targetNamespace = namespace ?? 'default'
      return deleteEvent(name, targetNamespace, resource as TResource, source)
    }
  }
}

const createClusterScopedMutationEvents = <TResource>(
  createEvent: (resource: TResource, source: string) => AppEvent,
  updateEvent: (
    name: string,
    resource: TResource,
    previous: TResource,
    source: string
  ) => AppEvent,
  deleteEvent: (name: string, resource: TResource, source: string) => AppEvent
): ResourceMutationEventFactory => {
  return {
    create: (resource, source) => {
      return createEvent(resource as TResource, source)
    },
    update: (name, _namespace, resource, previous, source) => {
      return updateEvent(
        name,
        resource as TResource,
        previous as TResource,
        source
      )
    },
    delete: (name, _namespace, resource, source) => {
      return deleteEvent(name, resource as TResource, source)
    }
  }
}

const RESOURCE_MUTATION_EVENTS: Record<
  ResourceKind,
  ResourceMutationEventFactory
> = {
  Pod: createNamespacedMutationEvents<Pod>(
    createPodCreatedEvent,
    createPodUpdatedEvent,
    createPodDeletedEvent
  ),
  ConfigMap: createNamespacedMutationEvents<ConfigMap>(
    createConfigMapCreatedEvent,
    createConfigMapUpdatedEvent,
    createConfigMapDeletedEvent
  ),
  ControllerRevision: createNamespacedMutationEvents<ControllerRevision>(
    createControllerRevisionCreatedEvent,
    createControllerRevisionUpdatedEvent,
    createControllerRevisionDeletedEvent
  ),
  Secret: createNamespacedMutationEvents<Secret>(
    createSecretCreatedEvent,
    createSecretUpdatedEvent,
    createSecretDeletedEvent
  ),
  Node: createClusterScopedMutationEvents<Node>(
    createNodeCreatedEvent,
    createNodeUpdatedEvent,
    createNodeDeletedEvent
  ),
  ReplicaSet: createNamespacedMutationEvents<ReplicaSet>(
    createReplicaSetCreatedEvent,
    createReplicaSetUpdatedEvent,
    createReplicaSetDeletedEvent
  ),
  Deployment: createNamespacedMutationEvents<Deployment>(
    createDeploymentCreatedEvent,
    createDeploymentUpdatedEvent,
    createDeploymentDeletedEvent
  ),
  DaemonSet: createNamespacedMutationEvents<DaemonSet>(
    createDaemonSetCreatedEvent,
    createDaemonSetUpdatedEvent,
    createDaemonSetDeletedEvent
  ),
  StatefulSet: createNamespacedMutationEvents<StatefulSet>(
    createStatefulSetCreatedEvent,
    createStatefulSetUpdatedEvent,
    createStatefulSetDeletedEvent
  ),
  Service: createNamespacedMutationEvents<Service>(
    createServiceCreatedEvent,
    createServiceUpdatedEvent,
    createServiceDeletedEvent
  ),
  Endpoints: createNamespacedMutationEvents<Endpoints>(
    createEndpointsCreatedEvent,
    createEndpointsUpdatedEvent,
    createEndpointsDeletedEvent
  ),
  EndpointSlice: createNamespacedMutationEvents<EndpointSlice>(
    createEndpointSliceCreatedEvent,
    createEndpointSliceUpdatedEvent,
    createEndpointSliceDeletedEvent
  ),
  Ingress: createNamespacedMutationEvents<Ingress>(
    createIngressCreatedEvent,
    createIngressUpdatedEvent,
    createIngressDeletedEvent
  ),
  PersistentVolume: createClusterScopedMutationEvents<PersistentVolume>(
    createPersistentVolumeCreatedEvent,
    createPersistentVolumeUpdatedEvent,
    createPersistentVolumeDeletedEvent
  ),
  PersistentVolumeClaim: createNamespacedMutationEvents<PersistentVolumeClaim>(
    createPersistentVolumeClaimCreatedEvent,
    createPersistentVolumeClaimUpdatedEvent,
    createPersistentVolumeClaimDeletedEvent
  ),
  Namespace: createClusterScopedMutationEvents<Namespace>(
    createNamespaceCreatedEvent,
    createNamespaceUpdatedEvent,
    createNamespaceDeletedEvent
  ),
  Lease: createNamespacedMutationEvents<Lease>(
    createLeaseCreatedEvent,
    createLeaseUpdatedEvent,
    createLeaseDeletedEvent
  )
}

const CLUSTER_SCOPED_KINDS = new Set<ResourceKind>([
  'Node',
  'Namespace',
  'PersistentVolume'
])

const isClusterScopedKind = (kind: ResourceKind): boolean => {
  return CLUSTER_SCOPED_KINDS.has(kind)
}

const resolveResourceNamespace = (
  kind: ResourceKind,
  namespace: string | undefined,
  resourceNamespace?: string
): string | undefined => {
  if (isClusterScopedKind(kind)) {
    return undefined
  }
  return namespace ?? resourceNamespace ?? 'default'
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
  const findResourceForMutation = <TKind extends ResourceKind>(
    kind: TKind,
    name: string,
    namespace: string | undefined
  ): Result<KindToResource<TKind>> => {
    if (namespace == null) {
      return clusterState.findByKind(kind, name) as Result<
        KindToResource<TKind>
      >
    }
    return clusterState.findByKind(kind, name, namespace) as Result<
      KindToResource<TKind>
    >
  }

  const emitResourceMutationEvent = <TKind extends ResourceKind>(
    kind: TKind,
    operation: 'create' | 'update' | 'delete',
    input: {
      name?: string
      namespace?: string
      resource: KindToResource<TKind>
      previous?: KindToResource<TKind>
    }
  ): void => {
    const mutationFactory = RESOURCE_MUTATION_EVENTS[kind]
    if (operation === 'create') {
      etcd.appendEvent(
        mutationFactory.create(
          input.resource as KindToResource<ResourceKind>,
          'api-server'
        )
      )
      return
    }
    if (operation === 'update') {
      if (input.name == null || input.previous == null) {
        return
      }
      etcd.appendEvent(
        mutationFactory.update(
          input.name,
          input.namespace,
          input.resource as KindToResource<ResourceKind>,
          input.previous as KindToResource<ResourceKind>,
          'api-server'
        )
      )
      return
    }
    if (input.name == null) {
      return
    }
    etcd.appendEvent(
      mutationFactory.delete(
        input.name,
        input.namespace,
        input.resource as KindToResource<ResourceKind>,
        'api-server'
      )
    )
  }

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
    requestPodDeletion: (name, namespace, options) => {
      const effectiveNamespace = namespace ?? 'default'
      const findResult = clusterState.findByKind(
        'Pod',
        name,
        effectiveNamespace
      )
      if (!findResult.ok) {
        return findResult as Result<Pod>
      }

      const source = options?.source ?? 'api-server'
      const shouldForceDelete = options?.force === true
      const configuredGracePeriod = shouldForceDelete
        ? 0
        : normalizeDeletionGracePeriodSeconds(options?.gracePeriodSeconds)
      const currentPod = findResult.value as Pod
      const alreadyTerminating = currentPod.metadata.deletionTimestamp != null
      if (alreadyTerminating) {
        return findResult as Result<Pod>
      }

      const deletionTimestamp = new Date().toISOString()
      const podWithTerminationConditions = withTerminatingPodConditions(
        currentPod,
        deletionTimestamp
      )
      const updatedPod: Pod = {
        ...podWithTerminationConditions,
        metadata: {
          ...podWithTerminationConditions.metadata,
          deletionTimestamp,
          deletionGracePeriodSeconds: configuredGracePeriod
        }
      }
      etcd.appendEvent(
        createPodUpdatedEvent(
          name,
          effectiveNamespace,
          updatedPod,
          currentPod,
          source
        )
      )

      return success(updatedPod)
    },
    finalizePodDeletion: (name, namespace, options) => {
      const effectiveNamespace = namespace ?? 'default'
      const findResult = clusterState.findByKind(
        'Pod',
        name,
        effectiveNamespace
      )
      if (!findResult.ok) {
        return findResult as Result<Pod>
      }
      etcd.appendEvent(
        createPodDeletedEvent(
          name,
          effectiveNamespace,
          findResult.value as Pod,
          options?.source ?? 'api-server'
        )
      )
      return findResult as Result<Pod>
    },
    deleteResource: (kind, name, namespace, options) => {
      if (kind === 'Pod') {
        const effectiveNamespace = resolveResourceNamespace(kind, namespace)
        const podDeletionResult = apiServer.requestPodDeletion(
          name,
          effectiveNamespace,
          {
            gracePeriodSeconds: options?.gracePeriodSeconds,
            force: options?.force,
            source: 'api-server'
          }
        )
        return podDeletionResult as Result<KindToResource<typeof kind>>
      }
      const effectiveNamespace = resolveResourceNamespace(kind, namespace)
      const findResult = findResourceForMutation(kind, name, effectiveNamespace)
      if (!findResult.ok) {
        return findResult as Result<KindToResource<typeof kind>>
      }
      emitResourceMutationEvent(kind, 'delete', {
        name,
        namespace: effectiveNamespace,
        resource: findResult.value as KindToResource<typeof kind>
      })
      return findResult as Result<KindToResource<typeof kind>>
    },
    createResource: (kind, resource) => {
      emitResourceMutationEvent(kind, 'create', {
        resource: resource as KindToResource<typeof kind>
      })
      return success(resource as KindToResource<typeof kind>)
    },
    updateResource: (kind, name, resource, namespace) => {
      const effectiveNamespace = resolveResourceNamespace(
        kind,
        namespace,
        resource.metadata.namespace
      )
      const previous = findResourceForMutation(kind, name, effectiveNamespace)
      if (!previous.ok) {
        return previous as Result<KindToResource<typeof kind>>
      }
      const normalizedResource =
        kind === 'Pod'
          ? (normalizePodUpdateResource(
              previous.value as Pod,
              resource as Pod
            ) as KindToResource<typeof kind>)
          : (resource as KindToResource<typeof kind>)
      emitResourceMutationEvent(kind, 'update', {
        name,
        namespace: effectiveNamespace,
        resource: normalizedResource,
        previous: previous.value as KindToResource<typeof kind>
      })
      return success(normalizedResource)
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
        const targetNamespace = resolveResourceNamespace(kind, namespace)
        if (targetNamespace == null) {
          return apiServer.findResource(kind, name) as ReturnType<
            BootstrapApiLike['findResource']
          >
        }
        return apiServer.findResource(
          kind,
          name,
          targetNamespace
        ) as ReturnType<BootstrapApiLike['findResource']>
      },
      listResources: (kind, namespace) => {
        const targetNamespace = resolveResourceNamespace(kind, namespace)
        if (targetNamespace == null) {
          return apiServer.listResources(kind) as ReturnType<
            BootstrapApiLike['listResources']
          >
        }
        return apiServer.listResources(kind, targetNamespace) as ReturnType<
          BootstrapApiLike['listResources']
        >
      },
      createResource: (kind, resource, namespace) => {
        const targetNamespace = resolveResourceNamespace(
          kind,
          namespace,
          resource.metadata.namespace
        )
        if (targetNamespace == null) {
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
        const targetNamespace = resolveResourceNamespace(
          kind,
          namespace,
          resource.metadata.namespace
        )
        if (targetNamespace == null) {
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
        const targetNamespace = resolveResourceNamespace(kind, namespace)
        if (targetNamespace == null) {
          return apiServer.deleteResource(kind, name) as ReturnType<
            BootstrapApiLike['deleteResource']
          >
        }
        return apiServer.deleteResource(
          kind,
          name,
          targetNamespace
        ) as ReturnType<BootstrapApiLike['deleteResource']>
      }
    }
    applyClusterBootstrapViaApi(bootstrapApi, options.bootstrap)
  }
  return apiServer
}
