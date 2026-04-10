import type { ApiServerFacade } from '../../api/ApiServerFacade'
import type { Pod } from '../../cluster/ressources/Pod'
import { type PodVolumeReadiness, type VolumeState } from '../VolumeState'

export type PodVolumeLifecycleReason =
  | 'VolumeReady'
  | 'FailedMount'
  | 'PersistentVolumeClaimNotFound'
  | 'PersistentVolumeClaimPending'
  | 'PersistentVolumeNotFound'
  | 'PersistentVolumeNotBound'
  | 'VolumeHostPathNodeUnavailable'
  | 'Skip'

export interface PodVolumeReconcileResult {
  readiness?: PodVolumeReadiness
  reason: PodVolumeLifecycleReason
  lifecycleEvent?: {
    namespace: string
    name: string
    reason: string
    message: string
    eventType: 'Normal' | 'Warning'
    source: string
  }
}

export interface PodVolumeReconcilerDeps {
  apiServer: ApiServerFacade
  volumeState: VolumeState
}

export const makePodVolumeKey = (namespace: string, name: string): string => {
  return `${namespace}/${name}`
}

export const parsePodVolumeKey = (
  podKey: string
): { namespace: string; name: string } => {
  const [namespace, name] = podKey.split('/')
  return { namespace, name }
}

const syncPodVolumeReadiness = (
  pod: Pod,
  deps: PodVolumeReconcilerDeps
): PodVolumeReconcileResult => {
  const volumes = pod.spec.volumes ?? []
  for (const volume of volumes) {
    if (volume.source.type === 'emptyDir') {
      continue
    }
    if (volume.source.type === 'configMap') {
      continue
    }
    if (volume.source.type === 'secret') {
      continue
    }
    if (volume.source.type === 'hostPath') {
      if (pod.spec.nodeName == null || pod.spec.nodeName.length === 0) {
        return {
          readiness: {
            ready: false,
            reason: 'VolumeHostPathNodeUnavailable'
          },
          reason: 'VolumeHostPathNodeUnavailable'
        }
      }
      deps.volumeState.reserveHostPath(pod.spec.nodeName, volume.source.path)
      continue
    }
    if (volume.source.type !== 'persistentVolumeClaim') {
      continue
    }

    const persistentVolumeClaimResult = deps.apiServer.findResource(
      'PersistentVolumeClaim',
      volume.source.claimName,
      pod.metadata.namespace
    )
    if (
      !persistentVolumeClaimResult.ok ||
      persistentVolumeClaimResult.value == null
    ) {
      return {
        readiness: {
          ready: false,
          reason: 'PersistentVolumeClaimNotFound'
        },
        reason: 'FailedMount'
      }
    }
    const persistentVolumeClaim = persistentVolumeClaimResult.value
    const boundVolumeName =
      persistentVolumeClaim.spec.volumeName ??
      deps.volumeState.getBoundVolumeForClaim(
        pod.metadata.namespace,
        volume.source.claimName
      )
    if (
      persistentVolumeClaim.status.phase !== 'Bound' ||
      boundVolumeName == null ||
      boundVolumeName.length === 0
    ) {
      return {
        readiness: {
          ready: false,
          reason: 'PersistentVolumeClaimPending'
        },
        reason: 'FailedMount'
      }
    }
    const persistentVolumeResult = deps.apiServer.findResource(
      'PersistentVolume',
      boundVolumeName
    )
    if (!persistentVolumeResult.ok || persistentVolumeResult.value == null) {
      return {
        readiness: {
          ready: false,
          reason: 'PersistentVolumeNotFound'
        },
        reason: 'FailedMount'
      }
    }
    if (persistentVolumeResult.value.status.phase !== 'Bound') {
      return {
        readiness: {
          ready: false,
          reason: 'PersistentVolumeNotBound'
        },
        reason: 'FailedMount'
      }
    }
  }

  return {
    readiness: { ready: true },
    reason: 'VolumeReady'
  }
}

export const reconcilePodVolumeByKey = (
  podKey: string,
  deps: PodVolumeReconcilerDeps
): PodVolumeReconcileResult => {
  const { namespace, name } = parsePodVolumeKey(podKey)
  const podResult = deps.apiServer.findResource('Pod', name, namespace)
  if (!podResult.ok || podResult.value == null) {
    deps.volumeState.removePodReadiness(namespace, name)
    return { reason: 'Skip' }
  }

  const pod = podResult.value
  const reconcileResult = syncPodVolumeReadiness(pod, deps)
  if (reconcileResult.readiness == null) {
    return { reason: 'Skip' }
  }
  deps.volumeState.setPodReadiness(namespace, name, reconcileResult.readiness)
  if (reconcileResult.reason === 'FailedMount') {
    return {
      ...reconcileResult,
      lifecycleEvent: {
        namespace: pod.metadata.namespace,
        name: pod.metadata.name,
        reason: 'FailedMount',
        message:
          'Unable to attach or mount volumes: timed out waiting for condition',
        eventType: 'Warning',
        source: 'kubelet'
      }
    }
  }
  return reconcileResult
}
