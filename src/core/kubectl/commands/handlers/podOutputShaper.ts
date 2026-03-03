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

const buildLastAppliedAnnotation = (pod: Pod): string => {
  const raw = {
    apiVersion: pod.apiVersion,
    kind: pod.kind,
    metadata: {
      annotations: {},
      name: pod.metadata.name,
      namespace: pod.metadata.namespace
    },
    spec: {
      containers: pod.spec.containers.map((container) => {
        const ports = container.ports?.map((port) => {
          return { containerPort: port.containerPort }
        })
        return {
          image: container.image,
          name: container.name,
          ...(ports != null ? { ports } : {})
        }
      })
    }
  }
  return JSON.stringify(raw)
}

const ensurePodConditions = (pod: Pod): PodCondition[] => {
  const transitionTime = pod.status.startTime ?? pod.metadata.creationTimestamp
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
      lastTransitionTime: condition.lastTransitionTime ?? transitionTime,
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
  if (status.state === 'Running') {
    return {
      running: {
        startedAt: status.startedAt ?? new Date().toISOString()
      }
    }
  }
  if (status.state === 'Terminated') {
    return {
      terminated: {
        reason: status.terminatedReason ?? 'Completed'
      }
    }
  }
  return {
    waiting: {
      reason: status.waitingReason ?? 'ContainerCreating'
    }
  }
}

export const shapePodForStructuredOutput = (
  pod: Pod
): Record<string, unknown> => {
  const podIP = buildPodIp(pod)
  const hostIP = pod.status.hostIP
  const startTime = pod.status.startTime ?? pod.metadata.creationTimestamp
  const observedGeneration =
    pod.status.observedGeneration ?? pod.metadata.generation ?? 1
  const kubeApiAccessVolumeName = buildKubeApiAccessVolumeName(pod)
  const metadataAnnotations = {
    ...(pod.metadata.annotations ?? {}),
    'kubectl.kubernetes.io/last-applied-configuration':
      buildLastAppliedAnnotation(pod)
  }
  const specContainers = pod.spec.containers.map((container) => {
    const ports = (container.ports ?? []).map((port) => {
      return {
        containerPort: port.containerPort,
        protocol: port.protocol ?? 'TCP'
      }
    })
    return {
      image: container.image,
      imagePullPolicy: 'IfNotPresent',
      name: container.name,
      ...(ports.length > 0 ? { ports } : {}),
      resources: container.resources ?? {},
      terminationMessagePath: '/dev/termination-log',
      terminationMessagePolicy: 'File',
      volumeMounts: [
        {
          mountPath: DEFAULT_SERVICE_ACCOUNT_VOLUME_MOUNT.mountPath,
          name: kubeApiAccessVolumeName,
          readOnly: DEFAULT_SERVICE_ACCOUNT_VOLUME_MOUNT.readOnly
        }
      ]
    }
  })
  const containerStatuses = (pod.status.containerStatuses ?? []).map(
    (status) => {
      return {
        containerID:
          status.containerID ??
          `containerd://${stableHash(`${pod.metadata.namespace}/${pod.metadata.name}/${status.name}`).repeat(8).slice(0, 64)}`,
        image: status.image,
        imageID:
          status.imageID ??
          `${status.image}@sha256:${stableHash(status.image).repeat(8).slice(0, 64)}`,
        lastState: {},
        name: status.name,
        ready: status.ready,
        resources: {},
        restartCount: status.restartCount,
        started: status.started ?? status.state === 'Running',
        state: toContainerState(status),
        user: {
          linux: {
            gid: 0,
            supplementalGroups: [0],
            uid: 0
          }
        },
        volumeMounts: [
          {
            mountPath: DEFAULT_SERVICE_ACCOUNT_VOLUME_MOUNT.mountPath,
            name: kubeApiAccessVolumeName,
            readOnly: DEFAULT_SERVICE_ACCOUNT_VOLUME_MOUNT.readOnly,
            recursiveReadOnly: 'Disabled'
          }
        ]
      }
    }
  )
  return {
    apiVersion: pod.apiVersion,
    kind: pod.kind,
    metadata: {
      annotations: metadataAnnotations,
      creationTimestamp: pod.metadata.creationTimestamp,
      generation: pod.metadata.generation ?? 1,
      name: pod.metadata.name,
      namespace: pod.metadata.namespace,
      resourceVersion: buildResourceVersion(pod),
      uid: buildUid(pod),
      ...(pod.metadata.labels != null ? { labels: pod.metadata.labels } : {}),
      ...(pod.metadata.ownerReferences != null
        ? { ownerReferences: pod.metadata.ownerReferences }
        : {})
    },
    spec: {
      containers: specContainers,
      dnsPolicy: 'ClusterFirst',
      enableServiceLinks: true,
      ...(pod.spec.nodeName != null ? { nodeName: pod.spec.nodeName } : {}),
      preemptionPolicy: 'PreemptLowerPriority',
      priority: 0,
      restartPolicy: 'Always',
      schedulerName: 'default-scheduler',
      securityContext: {},
      serviceAccount: 'default',
      serviceAccountName: 'default',
      terminationGracePeriodSeconds: 30,
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
      volumes: [
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
    },
    status: {
      conditions: ensurePodConditions(pod),
      containerStatuses,
      ...(hostIP != null ? { hostIP } : {}),
      ...(hostIP != null ? { hostIPs: [{ ip: hostIP }] } : {}),
      observedGeneration,
      phase: pod.status.phase,
      podIP,
      podIPs: [{ ip: podIP }],
      qosClass: pod.status.qosClass ?? 'BestEffort',
      startTime
    }
  }
}
