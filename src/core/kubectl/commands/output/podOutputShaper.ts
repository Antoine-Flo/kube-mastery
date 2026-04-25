import type {
  Pod,
  PodCondition,
  PodToleration
} from '../../../cluster/ressources/Pod'

type PodTolerationWithSeconds = PodToleration & {
  tolerationSeconds?: number
}

const DEFAULT_NO_EXECUTE_TOLERATIONS: PodTolerationWithSeconds[] = [
  {
    key: 'node.kubernetes.io/not-ready',
    operator: 'Exists' as const,
    effect: 'NoExecute' as const,
    tolerationSeconds: 300
  },
  {
    key: 'node.kubernetes.io/unreachable',
    operator: 'Exists' as const,
    effect: 'NoExecute' as const,
    tolerationSeconds: 300
  }
]

const DEFAULT_SERVICE_ACCOUNT_VOLUME_MOUNT = {
  mountPath: '/var/run/secrets/kubernetes.io/serviceaccount',
  readOnly: true
}

const PRIORITY_BY_CLASS_NAME: Record<string, number> = {
  'system-node-critical': 2000001000,
  'system-cluster-critical': 2000000000
}

const normalizeTimestampForOutput = (
  value: string | undefined
): string | undefined => {
  if (value == null) {
    return undefined
  }
  const parsedMs = Date.parse(value)
  if (Number.isNaN(parsedMs)) {
    return value
  }
  return new Date(parsedMs).toISOString().replace('.000Z', 'Z')
}

const stableHash = (value: string): string => {
  let hash = 0
  for (let index = 0; index < value.length; index++) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const buildUid = (pod: Pod): string => {
  const base = `${pod.metadata.namespace}/${pod.metadata.name}/${pod.metadata.creationTimestamp}`
  const chunk = stableHash(base)
  return `${chunk}-${chunk.slice(0, 4)}-${chunk.slice(4)}-${chunk.slice(0, 4)}-${chunk}${chunk.slice(0, 4)}`
}

const buildPodIp = (pod: Pod): string => {
  if (typeof pod.status.podIP === 'string' && pod.status.podIP.length > 0) {
    return pod.status.podIP
  }
  const source = `${pod.metadata.namespace}/${pod.metadata.name}`
  let hash = 0
  for (let index = 0; index < source.length; index++) {
    hash = (hash << 5) - hash + source.charCodeAt(index)
    hash |= 0
  }
  const thirdOctet = (Math.abs(hash) % 240) + 10
  const fourthOctet = (Math.abs(hash >> 4) % 240) + 10
  return `10.244.${thirdOctet}.${fourthOctet}`
}

const buildResourceVersion = (pod: Pod): string => {
  const base = `${pod.metadata.namespace}/${pod.metadata.name}/${pod.metadata.creationTimestamp}`
  const numeric = parseInt(stableHash(base).slice(0, 6), 16)
  return String((numeric % 9000) + 1000)
}

const buildKubeApiAccessVolumeName = (pod: Pod): string => {
  const token = stableHash(
    `${pod.metadata.namespace}/${pod.metadata.name}`
  ).slice(0, 5)
  return `kube-api-access-${token}`
}

const resolvePodPriority = (pod: Pod): number => {
  if (pod.spec.priority != null) {
    return pod.spec.priority
  }
  const priorityClassName = pod.spec.priorityClassName
  if (priorityClassName == null) {
    return 0
  }
  const knownPriority = PRIORITY_BY_CLASS_NAME[priorityClassName]
  if (knownPriority == null) {
    return 0
  }
  return knownPriority
}

const toProbeForOutput = (
  probe: Pod['spec']['containers'][number]['livenessProbe'] | undefined
): Record<string, unknown> | undefined => {
  if (probe == null) {
    return undefined
  }
  if (probe.type === 'httpGet') {
    return {
      failureThreshold: probe.failureThreshold ?? 3,
      httpGet: {
        path: probe.path,
        port: probe.port,
        scheme: 'HTTP'
      },
      ...(probe.initialDelaySeconds != null && {
        initialDelaySeconds: probe.initialDelaySeconds
      }),
      ...(probe.periodSeconds != null ? { periodSeconds: probe.periodSeconds } : {}),
      ...(probe.successThreshold != null && {
        successThreshold: probe.successThreshold
      }),
      ...(probe.timeoutSeconds != null && { timeoutSeconds: probe.timeoutSeconds })
    }
  }
  if (probe.type === 'exec') {
    return {
      failureThreshold: probe.failureThreshold ?? 3,
      exec: {
        command: probe.command
      },
      ...(probe.initialDelaySeconds != null && {
        initialDelaySeconds: probe.initialDelaySeconds
      }),
      ...(probe.periodSeconds != null ? { periodSeconds: probe.periodSeconds } : {}),
      ...(probe.successThreshold != null && {
        successThreshold: probe.successThreshold
      }),
      ...(probe.timeoutSeconds != null && { timeoutSeconds: probe.timeoutSeconds })
    }
  }
  return {
    failureThreshold: probe.failureThreshold ?? 3,
    tcpSocket: {
      port: probe.port
    },
    ...(probe.initialDelaySeconds != null && {
      initialDelaySeconds: probe.initialDelaySeconds
    }),
    ...(probe.periodSeconds != null ? { periodSeconds: probe.periodSeconds } : {}),
    ...(probe.successThreshold != null && {
      successThreshold: probe.successThreshold
    }),
    ...(probe.timeoutSeconds != null && { timeoutSeconds: probe.timeoutSeconds })
  }
}

const mapVolumeSourceForOutput = (
  volume: NonNullable<Pod['spec']['volumes']>[number]
): Record<string, unknown> => {
  if (volume.source.type === 'emptyDir') {
    return {
      emptyDir: {
        ...(volume.source.medium != null ? { medium: volume.source.medium } : {}),
        ...(volume.source.sizeLimit != null
          ? { sizeLimit: volume.source.sizeLimit }
          : {})
      }
    }
  }
  if (volume.source.type === 'hostPath') {
    return {
      hostPath: {
        path: volume.source.path,
        ...(volume.source.hostPathType != null
          ? { type: volume.source.hostPathType }
          : {})
      }
    }
  }
  if (volume.source.type === 'persistentVolumeClaim') {
    return {
      persistentVolumeClaim: {
        claimName: volume.source.claimName,
        ...(volume.source.readOnly != null
          ? { readOnly: volume.source.readOnly }
          : {})
      }
    }
  }
  if (volume.source.type === 'configMap') {
    return {
      configMap: {
        name: volume.source.name,
        ...(volume.source.defaultMode != null
          ? { defaultMode: volume.source.defaultMode }
          : {}),
        ...(volume.source.items != null ? { items: volume.source.items } : {})
      }
    }
  }
  return {
    secret: {
      secretName: volume.source.secretName
    }
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value != null
}

const resolveContainerSecurityContextValue = (
  container: Pod['spec']['containers'][number] | undefined,
  key: string
): unknown => {
  if (container == null || !isRecord(container.securityContext)) {
    return undefined
  }
  return container.securityContext[key]
}

const resolveContainerUser = (
  container: Pod['spec']['containers'][number] | undefined
): { linux: { uid: number; gid: number; supplementalGroups: number[] } } => {
  const runAsUser = resolveContainerSecurityContextValue(container, 'runAsUser')
  const runAsGroup = resolveContainerSecurityContextValue(container, 'runAsGroup')
  const supplementalGroupsValue = resolveContainerSecurityContextValue(
    container,
    'supplementalGroups'
  )
  if (typeof runAsUser === 'number' || typeof runAsGroup === 'number') {
    const resolvedUid = typeof runAsUser === 'number' ? runAsUser : 0
    const resolvedGid = typeof runAsGroup === 'number' ? runAsGroup : resolvedUid
    const supplementalGroups = Array.isArray(supplementalGroupsValue)
      ? supplementalGroupsValue.filter((group) => typeof group === 'number')
      : [resolvedGid]
    return {
      linux: {
        gid: resolvedGid,
        supplementalGroups:
          supplementalGroups.length > 0 ? supplementalGroups : [resolvedGid],
        uid: resolvedUid
      }
    }
  }
  const image = container?.image ?? ''
  if (image.includes('/coredns/coredns:')) {
    return {
      linux: {
        gid: 65532,
        supplementalGroups: [65532],
        uid: 65532
      }
    }
  }
  return {
    linux: {
      gid: 0,
      supplementalGroups: [0],
      uid: 0
    }
  }
}

const mapContainerVolumeMountsForOutput = (
  container: Pod['spec']['containers'][number] | undefined,
  kubeApiAccessVolumeName: string
): Array<Record<string, unknown>> => {
  const declaredVolumeMounts = (container?.volumeMounts ?? []).map((mount) => {
    return {
      mountPath: mount.mountPath,
      name: mount.name,
      ...(mount.readOnly != null ? { readOnly: mount.readOnly } : {})
    }
  })
  const hasServiceAccountMount = declaredVolumeMounts.some((mount) => {
    return mount.mountPath === DEFAULT_SERVICE_ACCOUNT_VOLUME_MOUNT.mountPath
  })
  const baseMounts = hasServiceAccountMount
    ? declaredVolumeMounts
    : [
        ...declaredVolumeMounts,
        {
          mountPath: DEFAULT_SERVICE_ACCOUNT_VOLUME_MOUNT.mountPath,
          name: kubeApiAccessVolumeName,
          readOnly: DEFAULT_SERVICE_ACCOUNT_VOLUME_MOUNT.readOnly
        }
      ]
  return baseMounts.map((mount) => {
    return {
      ...mount,
      recursiveReadOnly: 'Disabled'
    }
  })
}

const mapContainerResourcesForStatus = (
  container: Pod['spec']['containers'][number] | undefined
): Record<string, unknown> => {
  const requests = container?.resources?.requests
  const limits = container?.resources?.limits
  if (requests == null && limits == null) {
    return {}
  }
  return {
    ...(limits != null ? { limits } : {}),
    ...(requests != null ? { requests } : {})
  }
}

const mapAllocatedResourcesForStatus = (
  container: Pod['spec']['containers'][number] | undefined
): Record<string, unknown> | undefined => {
  const requests = container?.resources?.requests
  if (requests == null) {
    return undefined
  }
  return requests
}

const mapContainerEnvForOutput = (
  container: Pod['spec']['containers'][number]
): Array<Record<string, unknown>> => {
  const env = container.env ?? []
  if (env.length === 0) {
    return []
  }

  return env.map((envVar) => {
    if (envVar.source.type === 'value') {
      return {
        name: envVar.name,
        value: envVar.source.value
      }
    }
    if (envVar.source.type === 'configMapKeyRef') {
      return {
        name: envVar.name,
        valueFrom: {
          configMapKeyRef: {
            key: envVar.source.key,
            name: envVar.source.name
          }
        }
      }
    }
    return {
      name: envVar.name,
      valueFrom: {
        secretKeyRef: {
          key: envVar.source.key,
          name: envVar.source.name
        }
      }
    }
  })
}

const ensureTransitionTimeString = (value: string | undefined): string => {
  if (value == null) {
    return normalizeTimestampForOutput(new Date().toISOString())!
  }
  return normalizeTimestampForOutput(value) ?? value
}

const ensurePodConditions = (pod: Pod): PodCondition[] => {
  const fallbackTransitionTime = ensureTransitionTimeString(
    pod.status.startTime ?? pod.metadata.creationTimestamp
  )
  const latestExistingTransitionMs = (pod.status.conditions ?? []).reduce(
    (latest, condition) => {
      const normalized = normalizeTimestampForOutput(condition.lastTransitionTime)
      if (normalized == null) {
        return latest
      }
      const parsedMs = Date.parse(normalized)
      if (Number.isNaN(parsedMs)) {
        return latest
      }
      return parsedMs > latest ? parsedMs : latest
    },
    Number.NaN
  )
  const transitionTime = Number.isNaN(latestExistingTransitionMs)
    ? fallbackTransitionTime
    : normalizeTimestampForOutput(new Date(latestExistingTransitionMs).toISOString())!
  const regularNames = new Set(
    pod.spec.containers.map((container) => container.name)
  )
  const regularStatuses = (pod.status.containerStatuses ?? []).filter(
    (status) => {
      return regularNames.has(status.name)
    }
  )
  const allRegularReady =
    regularStatuses.length > 0 &&
    regularStatuses.every((status) => status.ready === true)
  const initialized =
    (pod.spec.initContainers?.length ?? 0) === 0 ||
    pod.status.phase === 'Running' ||
    pod.status.phase === 'Succeeded'
  const ready = pod.status.phase === 'Running' && allRegularReady
  const scheduled = pod.spec.nodeName != null && pod.spec.nodeName.length > 0
  const observedGeneration =
    pod.status.observedGeneration ?? pod.metadata.generation ?? 1
  const defaults: PodCondition[] = [
    {
      lastProbeTime: null,
      lastTransitionTime: transitionTime,
      observedGeneration,
      status: scheduled ? 'True' : 'False',
      type: 'PodReadyToStartContainers'
    },
    {
      lastProbeTime: null,
      lastTransitionTime: transitionTime,
      observedGeneration,
      status: initialized ? 'True' : 'False',
      type: 'Initialized'
    },
    {
      lastProbeTime: null,
      lastTransitionTime: transitionTime,
      observedGeneration,
      status: ready ? 'True' : 'False',
      type: 'Ready'
    },
    {
      lastProbeTime: null,
      lastTransitionTime: transitionTime,
      observedGeneration,
      status: ready ? 'True' : 'False',
      type: 'ContainersReady'
    },
    {
      lastProbeTime: null,
      lastTransitionTime: transitionTime,
      observedGeneration,
      status: scheduled ? 'True' : 'False',
      type: 'PodScheduled'
    }
  ]
  if (pod.status.conditions == null || pod.status.conditions.length === 0) {
    return defaults
  }
  const byType = new Map<PodCondition['type'], PodCondition>()
  for (const condition of pod.status.conditions) {
    byType.set(condition.type, {
      lastProbeTime: condition.lastProbeTime ?? null,
      lastTransitionTime: ensureTransitionTimeString(
        condition.lastTransitionTime ?? transitionTime
      ),
      observedGeneration: condition.observedGeneration ?? observedGeneration,
      status: condition.status,
      type: condition.type
    })
  }
  for (const condition of defaults) {
    if (!byType.has(condition.type)) {
      byType.set(condition.type, condition)
    }
  }
  return [
    byType.get('PodReadyToStartContainers')!,
    byType.get('Initialized')!,
    byType.get('Ready')!,
    byType.get('ContainersReady')!,
    byType.get('PodScheduled')!
  ]
}

const toContainerState = (
  status: NonNullable<Pod['status']['containerStatuses']>[number]
): Record<string, unknown> => {
  if (status.stateDetails?.state === 'Running') {
    return {
      running: {
        startedAt: normalizeTimestampForOutput(
          status.stateDetails.startedAt ?? new Date().toISOString()
        )
      }
    }
  }
  if (status.stateDetails?.state === 'Terminated') {
    return {
      terminated: {
        reason: status.stateDetails.reason ?? 'Completed',
        exitCode: status.stateDetails.exitCode ?? 0,
        ...(status.stateDetails.startedAt != null
          ? {
              startedAt: normalizeTimestampForOutput(
                status.stateDetails.startedAt
              )
            }
          : {}),
        ...(status.stateDetails.finishedAt != null
          ? {
              finishedAt: normalizeTimestampForOutput(
                status.stateDetails.finishedAt
              )
            }
          : {})
      }
    }
  }
  if (status.stateDetails?.state === 'Waiting') {
    return {
      waiting: {
        reason: status.stateDetails.reason ?? 'ContainerCreating'
      }
    }
  }
  return {
    waiting: {
      reason: 'ContainerCreating'
    }
  }
}

const toLastContainerState = (
  status: NonNullable<Pod['status']['containerStatuses']>[number]
): Record<string, unknown> => {
  if (status.lastStateDetails?.state === 'Running') {
    return {
      running: {
        ...(status.lastStateDetails.startedAt != null
          ? {
              startedAt: normalizeTimestampForOutput(
                status.lastStateDetails.startedAt
              )
            }
          : {})
      }
    }
  }
  if (status.lastStateDetails?.state === 'Terminated') {
    return {
      terminated: {
        reason: status.lastStateDetails.reason ?? 'Completed',
        exitCode: status.lastStateDetails.exitCode ?? 0,
        ...(status.lastStateDetails.startedAt != null
          ? {
              startedAt: normalizeTimestampForOutput(
                status.lastStateDetails.startedAt
              )
            }
          : {}),
        ...(status.lastStateDetails.finishedAt != null
          ? {
              finishedAt: normalizeTimestampForOutput(
                status.lastStateDetails.finishedAt
              )
            }
          : {})
      }
    }
  }
  if (status.lastStateDetails?.state === 'Waiting') {
    return {
      waiting: {
        reason: status.lastStateDetails.reason ?? 'ContainerCreating'
      }
    }
  }
  return {}
}

const shouldOmitSyntheticLastState = (
  status: NonNullable<Pod['status']['containerStatuses']>[number],
  lastState: Record<string, unknown>
): boolean => {
  if (status.restartCount > 0) {
    return false
  }
  const waiting = isRecord(lastState.waiting) ? lastState.waiting : undefined
  if (waiting == null) {
    return false
  }
  const reason = waiting.reason
  return reason === 'ContainerCreating'
}

const toStatusImageIdForOutput = (
  imageId: string | undefined,
  containerId: string | undefined,
  phase: Pod['status']['phase']
): string | undefined => {
  if (imageId == null) {
    return undefined
  }
  if (phase !== 'Running') {
    return imageId
  }
  if (containerId == null || !containerId.startsWith('containerd://')) {
    return imageId
  }
  const digestToken = '@sha256:'
  const digestIndex = imageId.indexOf(digestToken)
  if (digestIndex === -1) {
    return imageId
  }
  return imageId.slice(digestIndex + 1)
}

export const shapePodForStructuredOutput = (
  pod: Pod
): Record<string, unknown> => {
  const podIP = buildPodIp(pod)
  const hostIP = pod.status.hostIP
  const startTime = normalizeTimestampForOutput(
    pod.status.startTime ?? pod.metadata.creationTimestamp
  )
  const observedGeneration =
    pod.status.observedGeneration ?? pod.metadata.generation ?? 1
  const kubeApiAccessVolumeName = buildKubeApiAccessVolumeName(pod)
  const metadataAnnotations = pod.metadata.annotations ?? {}
  const specInitContainers = (pod.spec.initContainers ?? []).map(
    (container) => {
      const livenessProbe = toProbeForOutput(container.livenessProbe)
      const readinessProbe = toProbeForOutput(container.readinessProbe)
      const startupProbe = toProbeForOutput(container.startupProbe)
      return {
        ...(container.command != null && container.command.length > 0
          ? { command: container.command }
          : {}),
        ...(container.args != null && container.args.length > 0
          ? { args: container.args }
          : {}),
        image: container.image,
        imagePullPolicy: container.imagePullPolicy ?? 'IfNotPresent',
        name: container.name,
        ...(livenessProbe != null ? { livenessProbe } : {}),
        ...(readinessProbe != null ? { readinessProbe } : {}),
        ...(startupProbe != null ? { startupProbe } : {}),
        ...(container.securityContext != null
          ? { securityContext: container.securityContext }
          : {}),
        resources: container.resources ?? {},
        terminationMessagePath:
          container.terminationMessagePath ?? '/dev/termination-log',
        terminationMessagePolicy: container.terminationMessagePolicy ?? 'File'
      }
    }
  )
  const specContainers = pod.spec.containers.map((container) => {
    const livenessProbe = toProbeForOutput(container.livenessProbe)
    const readinessProbe = toProbeForOutput(container.readinessProbe)
    const startupProbe = toProbeForOutput(container.startupProbe)
    const ports = (container.ports ?? []).map((port) => {
      return {
        containerPort: port.containerPort,
        ...(port.name != null ? { name: port.name } : {}),
        protocol: port.protocol ?? 'TCP'
      }
    })
    const env = mapContainerEnvForOutput(container)
    const declaredVolumeMounts = (container.volumeMounts ?? []).map((mount) => {
      return {
        mountPath: mount.mountPath,
        name: mount.name,
        ...(mount.readOnly != null ? { readOnly: mount.readOnly } : {})
      }
    })
    const hasServiceAccountMount = declaredVolumeMounts.some((mount) => {
      return mount.mountPath === DEFAULT_SERVICE_ACCOUNT_VOLUME_MOUNT.mountPath
    })
    const volumeMounts = hasServiceAccountMount
      ? declaredVolumeMounts
      : [
          ...declaredVolumeMounts,
          {
            mountPath: DEFAULT_SERVICE_ACCOUNT_VOLUME_MOUNT.mountPath,
            name: kubeApiAccessVolumeName,
            readOnly: DEFAULT_SERVICE_ACCOUNT_VOLUME_MOUNT.readOnly
          }
        ]
    return {
      ...(container.command != null && container.command.length > 0
        ? { command: container.command }
        : {}),
      ...(container.args != null && container.args.length > 0
        ? { args: container.args }
        : {}),
      image: container.image,
      imagePullPolicy: container.imagePullPolicy ?? 'IfNotPresent',
      name: container.name,
      ...(env.length > 0 ? { env } : {}),
      ...(ports.length > 0 ? { ports } : {}),
      ...(livenessProbe != null ? { livenessProbe } : {}),
      ...(readinessProbe != null ? { readinessProbe } : {}),
      ...(startupProbe != null ? { startupProbe } : {}),
      ...(container.securityContext != null
        ? { securityContext: container.securityContext }
        : {}),
      resources: container.resources ?? {},
      terminationMessagePath:
        container.terminationMessagePath ?? '/dev/termination-log',
      terminationMessagePolicy: container.terminationMessagePolicy ?? 'File',
      volumeMounts
    }
  })
  const allContainerStatuses = (pod.status.containerStatuses ?? []).map(
    (status) => {
      const containerSpec = [
        ...(pod.spec.initContainers ?? []),
        ...pod.spec.containers
      ].find((container) => {
        return container.name === status.name
      })
      const allocatedResources = mapAllocatedResourcesForStatus(containerSpec)
      const lastState = toLastContainerState(status)
      const lastStateForOutput = shouldOmitSyntheticLastState(status, lastState)
        ? {}
        : lastState
      const defaultImageId = `${status.image}@sha256:${stableHash(status.image).repeat(8).slice(0, 64)}`
      const imageIdForOutput = toStatusImageIdForOutput(
        status.imageID ?? defaultImageId,
        status.containerID,
        pod.status.phase
      )
      return {
        ...(allocatedResources != null ? { allocatedResources } : {}),
        containerID:
          status.containerID ??
          `containerd://${stableHash(`${pod.metadata.namespace}/${pod.metadata.name}/${status.name}`).repeat(8).slice(0, 64)}`,
        image: status.image,
        ...(imageIdForOutput != null ? { imageID: imageIdForOutput } : {}),
        ...(Object.keys(lastStateForOutput).length > 0
          ? { lastState: lastStateForOutput }
          : {}),
        name: status.name,
        ready: status.ready,
        resources: mapContainerResourcesForStatus(containerSpec),
        restartCount: status.restartCount,
        started: status.started ?? status.stateDetails?.state === 'Running',
        state: toContainerState(status),
        user: resolveContainerUser(containerSpec),
        volumeMounts: mapContainerVolumeMountsForOutput(
          containerSpec,
          kubeApiAccessVolumeName
        )
      }
    }
  )
  const initContainerNames = new Set(
    (pod.spec.initContainers ?? []).map((container) => container.name)
  )
  const initContainerStatuses = allContainerStatuses.filter((status) => {
    return initContainerNames.has(status.name)
  })
  const containerStatuses = allContainerStatuses.filter((status) => {
    return initContainerNames.has(status.name) === false
  })
  const controllerOwnerReference = pod.metadata.ownerReferences?.find((ownerRef) => {
    return ownerRef.controller === true
  })
  const generateName =
    controllerOwnerReference != null &&
    pod.metadata.name.startsWith(`${controllerOwnerReference.name}-`)
      ? `${controllerOwnerReference.name}-`
      : undefined
  const normalizedOwnerReferences = (pod.metadata.ownerReferences ?? []).map(
    (ownerReference) => {
      return {
        apiVersion: ownerReference.apiVersion,
        ...(ownerReference.blockOwnerDeletion != null
          ? { blockOwnerDeletion: ownerReference.blockOwnerDeletion }
          : ownerReference.controller === true
            ? { blockOwnerDeletion: true }
            : {}),
        ...(ownerReference.controller != null
          ? { controller: ownerReference.controller }
          : {}),
        kind: ownerReference.kind,
        name: ownerReference.name,
        uid: ownerReference.uid
      }
    }
  )
  const metadataKeysOrder: Record<string, unknown> = {
    creationTimestamp: normalizeTimestampForOutput(pod.metadata.creationTimestamp),
    ...(generateName != null ? { generateName } : {}),
    generation: pod.metadata.generation ?? 1,
    ...(pod.metadata.labels != null &&
    Object.keys(pod.metadata.labels).length > 0
      ? { labels: pod.metadata.labels }
      : {}),
    name: pod.metadata.name,
    namespace: pod.metadata.namespace,
    resourceVersion: buildResourceVersion(pod),
    uid: buildUid(pod)
  }
  if (Object.keys(metadataAnnotations).length > 0) {
    metadataKeysOrder.annotations = metadataAnnotations
  }
  if (normalizedOwnerReferences.length > 0) {
    metadataKeysOrder.ownerReferences = normalizedOwnerReferences
  }

  const declaredVolumes = (pod.spec.volumes ?? []).map((volume) => {
    return {
      name: volume.name,
      ...mapVolumeSourceForOutput(volume)
    }
  })
  const hasServiceAccountVolume = declaredVolumes.some((volume) => {
    return volume.name === kubeApiAccessVolumeName
  })
  const volumes = hasServiceAccountVolume
    ? declaredVolumes
    : [
        ...declaredVolumes,
        {
          name: kubeApiAccessVolumeName,
          projected: {
            defaultMode: 420,
            sources: [
              {
                serviceAccountToken: {
                  expirationSeconds: 3607,
                  path: 'token'
                }
              },
              {
                configMap: {
                  items: [{ key: 'ca.crt', path: 'ca.crt' }],
                  name: 'kube-root-ca.crt'
                }
              },
              {
                downwardAPI: {
                  items: [
                    {
                      fieldRef: {
                        apiVersion: 'v1',
                        fieldPath: 'metadata.namespace'
                      },
                      path: 'namespace'
                    }
                  ]
                }
              }
            ]
          }
        }
      ]
  const serviceAccountName =
    pod.spec.serviceAccountName ?? pod.spec.serviceAccount ?? 'default'
  const serviceAccount = pod.spec.serviceAccount ?? serviceAccountName

  return {
    apiVersion: pod.apiVersion,
    kind: pod.kind,
    metadata: metadataKeysOrder,
    spec: {
      containers: specContainers,
      ...(specInitContainers.length > 0
        ? { initContainers: specInitContainers }
        : {}),
      ...(pod.spec.affinity != null ? { affinity: pod.spec.affinity } : {}),
      dnsPolicy: pod.spec.dnsPolicy ?? 'ClusterFirst',
      enableServiceLinks: pod.spec.enableServiceLinks ?? true,
      ...(pod.spec.nodeName != null ? { nodeName: pod.spec.nodeName } : {}),
      ...(pod.spec.nodeSelector != null ? { nodeSelector: pod.spec.nodeSelector } : {}),
      preemptionPolicy: pod.spec.preemptionPolicy ?? 'PreemptLowerPriority',
      priority: resolvePodPriority(pod),
      ...(pod.spec.priorityClassName != null
        ? { priorityClassName: pod.spec.priorityClassName }
        : {}),
      restartPolicy: pod.spec.restartPolicy ?? 'Always',
      schedulerName: pod.spec.schedulerName ?? 'default-scheduler',
      securityContext: pod.spec.securityContext ?? {},
      serviceAccount,
      serviceAccountName,
      terminationGracePeriodSeconds:
        pod.spec.terminationGracePeriodSeconds ?? 30,
      tolerations: (pod.spec.tolerations ?? DEFAULT_NO_EXECUTE_TOLERATIONS).map(
        (toleration) => {
          const tolerationWithSeconds = toleration as PodTolerationWithSeconds
          return {
            ...(toleration.effect != null ? { effect: toleration.effect } : {}),
            ...(toleration.key != null ? { key: toleration.key } : {}),
            ...(toleration.operator != null
              ? { operator: toleration.operator }
              : {}),
            ...(toleration.value != null ? { value: toleration.value } : {}),
            ...(tolerationWithSeconds.tolerationSeconds != null
              ? { tolerationSeconds: tolerationWithSeconds.tolerationSeconds }
              : {})
          }
        }
      ),
      volumes
    },
    status: {
      conditions: ensurePodConditions(pod),
      containerStatuses,
      ...(initContainerStatuses.length > 0 ? { initContainerStatuses } : {}),
      ...(hostIP != null ? { hostIP } : {}),
      ...(hostIP != null ? { hostIPs: [{ ip: hostIP }] } : {}),
      observedGeneration,
      phase: pod.status.phase,
      podIP,
      podIPs: [{ ip: podIP }],
      qosClass: pod.status.qosClass ?? 'BestEffort',
      ...(startTime != null ? { startTime } : {})
    }
  }
}
