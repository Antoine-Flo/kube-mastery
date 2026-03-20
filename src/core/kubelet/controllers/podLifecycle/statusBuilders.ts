import type {
  ContainerRuntimeStateDetails,
  ContainerStatus
} from '../../../cluster/ressources/Pod'

const buildFallbackWaitingState = (): ContainerRuntimeStateDetails => {
  return {
    state: 'Waiting',
    reason: 'ContainerCreating'
  }
}

export const hasContainerStatusChanged = (
  previous: ContainerStatus | undefined,
  next: ContainerStatus
): boolean => {
  if (previous == null) {
    return true
  }
  if (
    JSON.stringify(previous.stateDetails) !== JSON.stringify(next.stateDetails)
  ) {
    return true
  }
  if (
    JSON.stringify(previous.lastStateDetails) !==
    JSON.stringify(next.lastStateDetails)
  ) {
    return true
  }
  if (previous.restartCount !== next.restartCount) {
    return true
  }
  if (previous.lastRestartAt !== next.lastRestartAt) {
    return true
  }
  if (previous.containerID !== next.containerID) {
    return true
  }
  if (previous.startedAt !== next.startedAt) {
    return true
  }
  return previous.started !== next.started
}

export const buildWaitingContainerStatuses = (
  currentStatuses: ContainerStatus[],
  regularContainerNames: Set<string>,
  waitingReason: string,
  transitionTime: string,
  options?: {
    incrementRestartOnCrash?: boolean
  }
): ContainerStatus[] => {
  return currentStatuses.map((status) => {
    if (!regularContainerNames.has(status.name)) {
      return status
    }
    const previousStateDetails =
      status.stateDetails ?? buildFallbackWaitingState()
    return {
      ...status,
      ready: false,
      stateDetails: {
        state: 'Waiting' as const,
        reason: waitingReason
      },
      lastStateDetails: previousStateDetails,
      started: false,
      startedAt: undefined,
      ...(options?.incrementRestartOnCrash === true
        ? {
            lastRestartAt: transitionTime,
            restartCount: (status.restartCount ?? 0) + 1
          }
        : {})
    }
  })
}

export const buildTerminatedContainerStatuses = (
  currentStatuses: ContainerStatus[],
  regularContainerNames: Set<string>,
  transitionTime: string,
  terminatedReason: string,
  terminatedExitCode: number,
  terminatedRuntimeRecords: Map<
    string,
    {
      containerId: string
      startedAt: string
      finishedAt?: string
      exitCode?: number
      reason?: string
    }
  >,
  options?: {
    incrementRestartOnCrash?: boolean
  }
): ContainerStatus[] => {
  return currentStatuses.map((status) => {
    if (!regularContainerNames.has(status.name)) {
      return status
    }
    const previousStateDetails =
      status.stateDetails ?? buildFallbackWaitingState()
    const terminatedRuntimeRecord = terminatedRuntimeRecords.get(status.name)
    return {
      ...status,
      ready: false,
      containerID: terminatedRuntimeRecord?.containerId ?? status.containerID,
      stateDetails: {
        state: 'Terminated' as const,
        reason: terminatedRuntimeRecord?.reason ?? terminatedReason,
        exitCode: terminatedRuntimeRecord?.exitCode ?? terminatedExitCode,
        startedAt: terminatedRuntimeRecord?.startedAt ?? status.startedAt,
        finishedAt: terminatedRuntimeRecord?.finishedAt ?? transitionTime
      },
      lastStateDetails: previousStateDetails,
      started: false,
      startedAt: undefined,
      ...(options?.incrementRestartOnCrash === true
        ? {
            lastRestartAt: status.lastRestartAt ?? transitionTime,
            restartCount: (status.restartCount ?? 0) + 1
          }
        : {})
    }
  })
}
