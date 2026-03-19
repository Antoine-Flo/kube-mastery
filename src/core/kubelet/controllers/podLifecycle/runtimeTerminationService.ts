import type { Pod } from '../../../cluster/ressources/Pod'
import type { ContainerProcessRuntime } from '../../../runtime/ContainerProcessRuntime'
import type { ContainerRuntimeSimulator } from '../../../runtime/ContainerRuntimeSimulator'

export type RuntimeTerminationRecord = {
  containerId: string
  startedAt: string
  finishedAt?: string
  exitCode?: number
  reason?: string
}

const getPodNodeName = (pod: Pod): string | undefined => {
  const nodeName = pod.spec.nodeName
  if (nodeName == null || nodeName.length === 0) {
    return undefined
  }
  return nodeName
}

export const clearPodProcessRuntimeState = (
  pod: Pod,
  processRuntime: ContainerProcessRuntime | undefined
): void => {
  if (processRuntime == null) {
    return
  }
  const nodeName = getPodNodeName(pod)
  if (nodeName == null) {
    return
  }
  processRuntime.clearPodProcesses({
    nodeName,
    namespace: pod.metadata.namespace,
    podName: pod.metadata.name
  })
}

export const signalPodProcessRuntime = (
  pod: Pod,
  processRuntime: ContainerProcessRuntime | undefined,
  signal: 'SIGTERM' | 'SIGKILL'
): void => {
  if (processRuntime == null) {
    return
  }
  const nodeName = getPodNodeName(pod)
  if (nodeName == null) {
    return
  }
  for (const container of pod.spec.containers) {
    processRuntime.signalMainProcess({
      nodeName,
      namespace: pod.metadata.namespace,
      podName: pod.metadata.name,
      containerName: container.name,
      signal
    })
  }
}

export const hasRunningPodProcessRuntime = (
  pod: Pod,
  processRuntime: ContainerProcessRuntime | undefined
): boolean => {
  if (processRuntime == null) {
    return false
  }
  const nodeName = getPodNodeName(pod)
  if (nodeName == null) {
    return false
  }
  const processRecords = processRuntime.listProcesses({
    nodeName,
    namespace: pod.metadata.namespace,
    podName: pod.metadata.name
  })
  for (const processRecord of processRecords) {
    if (processRecord.state === 'Running') {
      return true
    }
  }
  return false
}

export const terminatePodRuntimeContainers = (
  pod: Pod,
  containerRuntime: ContainerRuntimeSimulator | undefined,
  options: { reason: string; exitCode: number }
): Map<string, RuntimeTerminationRecord> => {
  const terminatedByName = new Map<string, RuntimeTerminationRecord>()
  if (containerRuntime == null) {
    return terminatedByName
  }
  const nodeName = getPodNodeName(pod)
  if (nodeName == null) {
    return terminatedByName
  }
  const runningContainers = containerRuntime.listContainers({
    nodeName,
    namespace: pod.metadata.namespace,
    podName: pod.metadata.name,
    state: 'Running'
  })
  for (const record of runningContainers) {
    containerRuntime.stopContainer({
      containerId: record.containerId,
      exitCode: options.exitCode,
      reason: options.reason
    })
    const terminated = containerRuntime.getContainer(record.containerId)
    if (terminated == null) {
      continue
    }
    terminatedByName.set(record.containerName, {
      containerId: terminated.containerId,
      startedAt: terminated.startedAt,
      finishedAt: terminated.finishedAt,
      exitCode: terminated.exitCode,
      reason: terminated.reason
    })
  }
  return terminatedByName
}
