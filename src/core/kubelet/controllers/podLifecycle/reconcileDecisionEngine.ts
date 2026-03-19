import { isPodTerminating, type Pod } from '../../../cluster/ressources/Pod'
import type { PodVolumeReadiness } from '../../../volumes/VolumeState'

export type ReconcileDecision =
  | { type: 'NotFound' }
  | { type: 'Terminating'; pod: Pod }
  | { type: 'NotSchedulable'; pod: Pod }
  | { type: 'VolumeBlocked'; pod: Pod; reason?: string }
  | { type: 'StartupIssue'; pod: Pod; reason: string }
  | { type: 'AlreadyPending'; pod: Pod }
  | { type: 'ReadyToStart'; pod: Pod }

export const buildReconcileDecision = (
  input: {
    pod: Pod | undefined
    hasPendingTimeout: boolean
    shouldProgressPod: (pod: Pod) => boolean
    volumeReadinessProbe?: (pod: Pod) => PodVolumeReadiness
    detectStartupIssueReason: (pod: Pod) => string | undefined
  }
): ReconcileDecision => {
  const pod = input.pod
  if (pod == null) {
    return { type: 'NotFound' }
  }
  if (isPodTerminating(pod)) {
    return { type: 'Terminating', pod }
  }
  if (!input.shouldProgressPod(pod)) {
    return { type: 'NotSchedulable', pod }
  }
  const volumeReadiness = input.volumeReadinessProbe?.(pod)
  if (volumeReadiness != null && !volumeReadiness.ready) {
    return {
      type: 'VolumeBlocked',
      pod,
      reason: volumeReadiness.reason
    }
  }
  const startupIssueReason = input.detectStartupIssueReason(pod)
  if (startupIssueReason != null) {
    return {
      type: 'StartupIssue',
      pod,
      reason: startupIssueReason
    }
  }
  if (input.hasPendingTimeout) {
    return { type: 'AlreadyPending', pod }
  }
  return { type: 'ReadyToStart', pod }
}
