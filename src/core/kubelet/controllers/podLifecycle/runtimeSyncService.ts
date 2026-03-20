import type {
  ContainerRuntimeStateDetails,
  Pod
} from '../../../cluster/ressources/Pod'
import type { ContainerProcessRuntime } from '../../../runtime/ContainerProcessRuntime'
import type { ContainerRuntimeSimulator } from '../../../runtime/ContainerRuntimeSimulator'
import { hasContainerStatusChanged } from './statusBuilders'

const hasProcessCommand = (
  container: Pod['spec']['containers'][number]
): boolean => {
  if (container.command != null && container.command.length > 0) {
    return true
  }
  if (container.args != null && container.args.length > 0) {
    return true
  }
  return false
}

const getProcessRuntimeIdentity = (
  pod: Pod,
  containerName: string
): {
  nodeName: string
  namespace: string
  podName: string
  containerName: string
} | null => {
  const nodeName = pod.spec.nodeName
  if (nodeName == null || nodeName.length === 0) {
    return null
  }
  return {
    nodeName,
    namespace: pod.metadata.namespace,
    podName: pod.metadata.name,
    containerName
  }
}

export const syncRunningPodRuntimeState = (
  pod: Pod,
  options: {
    containerRuntime?: ContainerRuntimeSimulator
    processRuntime?: ContainerProcessRuntime
  }
): Pod => {
  const runtime = options.containerRuntime
  const processRuntime = options.processRuntime
  if (runtime == null && processRuntime == null) {
    return pod
  }
  const nodeName = pod.spec.nodeName
  if (nodeName == null || nodeName.length === 0) {
    return pod
  }
  const statuses = pod.status.containerStatuses ?? []
  const regularContainersByName = new Map(
    pod.spec.containers.map((container) => {
      return [container.name, container]
    })
  )
  let hasChanged = false
  const updatedStatuses = statuses.map((status) => {
    const containerSpec = regularContainersByName.get(status.name)
    if (containerSpec == null) {
      return status
    }
    if (status.stateDetails?.state !== 'Running') {
      return status
    }

    const shouldUseProcessRuntime = hasProcessCommand(containerSpec)
    if (processRuntime != null && shouldUseProcessRuntime) {
      const identity = getProcessRuntimeIdentity(pod, containerSpec.name)
      if (identity != null) {
        const processRecord = processRuntime.ensureMainProcess({
          ...identity,
          command: containerSpec.command,
          args: containerSpec.args
        })
        if (processRecord.state === 'Exited') {
          const nextStatus = {
            ...status,
            ready: false,
            started: false,
            startedAt: undefined,
            stateDetails: {
              state: 'Terminated' as const,
              reason: processRecord.reason ?? 'Completed',
              exitCode: processRecord.exitCode ?? 0,
              startedAt: processRecord.startedAt,
              finishedAt: processRecord.finishedAt
            },
            lastStateDetails: status.stateDetails
          }
          if (hasContainerStatusChanged(status, nextStatus)) {
            hasChanged = true
          }
          return nextStatus
        }
        const runningStatus = {
          ...status,
          stateDetails: {
            ...status.stateDetails,
            state: 'Running' as const,
            startedAt: processRecord.startedAt
          },
          startedAt: processRecord.startedAt,
          started: true
        }
        if (hasContainerStatusChanged(status, runningStatus)) {
          hasChanged = true
        }
        return runningStatus
      }
    }

    if (runtime == null) {
      return status
    }
    const running = runtime.listContainers({
      nodeName,
      namespace: pod.metadata.namespace,
      podName: pod.metadata.name,
      containerName: status.name,
      state: 'Running'
    })
    const record =
      running[0] ??
      runtime.startContainer({
        nodeName,
        namespace: pod.metadata.namespace,
        podName: pod.metadata.name,
        containerName: status.name,
        image: status.image
      })
    const nextStateDetails: ContainerRuntimeStateDetails = {
      ...status.stateDetails,
      state: 'Running',
      startedAt: record.startedAt
    }
    const nextStatus = {
      ...status,
      stateDetails: nextStateDetails,
      startedAt: record.startedAt,
      containerID: record.containerId
    }
    if (hasContainerStatusChanged(status, nextStatus)) {
      hasChanged = true
    }
    return nextStatus
  })
  if (!hasChanged) {
    return pod
  }
  return {
    ...pod,
    status: {
      ...pod.status,
      containerStatuses: updatedStatuses
    }
  }
}
