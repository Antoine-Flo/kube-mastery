export type RuntimeContainerState = 'Running' | 'Terminated'

export interface RuntimeContainerRecord {
  containerId: string
  nodeName: string
  namespace: string
  podName: string
  containerName: string
  image: string
  state: RuntimeContainerState
  startedAt: string
  finishedAt?: string
  exitCode?: number
  reason?: string
}

export interface StartRuntimeContainerInput {
  nodeName: string
  namespace: string
  podName: string
  containerName: string
  image: string
}

export interface StopRuntimeContainerInput {
  containerId: string
  exitCode?: number
  reason?: string
}

export interface ListRuntimeContainersFilter {
  nodeName?: string
  namespace?: string
  podName?: string
  containerName?: string
  state?: RuntimeContainerState
}

export interface ContainerRuntimeSimulator {
  readonly runtimeName: string
  readonly runtimeVersion: string
  getRuntimeId: () => string
  startContainer: (input: StartRuntimeContainerInput) => RuntimeContainerRecord
  stopContainer: (input: StopRuntimeContainerInput) => RuntimeContainerRecord | undefined
  getContainer: (containerId: string) => RuntimeContainerRecord | undefined
  listContainers: (filter?: ListRuntimeContainersFilter) => RuntimeContainerRecord[]
  getContainerCount: () => number
}

const stableHash = (value: string): string => {
  let hash = 0
  for (let index = 0; index < value.length; index++) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

const buildContainerId = (
  runtimeName: string,
  input: StartRuntimeContainerInput
): string => {
  const key = `${input.nodeName}/${input.namespace}/${input.podName}/${input.containerName}/${input.image}`
  const digest = stableHash(key).repeat(8).slice(0, 64)
  return `${runtimeName}://${digest}`
}

export const createContainerRuntimeSimulator = (): ContainerRuntimeSimulator => {
  const runtimeName = 'containerd'
  const runtimeVersion = '2.2.0'
  const containers = new Map<string, RuntimeContainerRecord>()

  const getRuntimeId = (): string => {
    return `${runtimeName}://${runtimeVersion}`
  }

  const startContainer = (
    input: StartRuntimeContainerInput
  ): RuntimeContainerRecord => {
    const now = new Date().toISOString()
    const containerId = buildContainerId(runtimeName, input)
    const record: RuntimeContainerRecord = {
      containerId,
      nodeName: input.nodeName,
      namespace: input.namespace,
      podName: input.podName,
      containerName: input.containerName,
      image: input.image,
      state: 'Running',
      startedAt: now
    }
    containers.set(containerId, record)
    return record
  }

  const stopContainer = (
    input: StopRuntimeContainerInput
  ): RuntimeContainerRecord | undefined => {
    const existing = containers.get(input.containerId)
    if (existing == null) {
      return undefined
    }
    const updated: RuntimeContainerRecord = {
      ...existing,
      state: 'Terminated',
      finishedAt: new Date().toISOString(),
      exitCode: input.exitCode ?? 0,
      reason: input.reason ?? 'Completed'
    }
    containers.set(input.containerId, updated)
    return updated
  }

  const getContainer = (containerId: string): RuntimeContainerRecord | undefined => {
    return containers.get(containerId)
  }

  const listContainers = (
    filter: ListRuntimeContainersFilter = {}
  ): RuntimeContainerRecord[] => {
    return [...containers.values()].filter((container) => {
      if (filter.nodeName != null && container.nodeName !== filter.nodeName) {
        return false
      }
      if (filter.namespace != null && container.namespace !== filter.namespace) {
        return false
      }
      if (filter.podName != null && container.podName !== filter.podName) {
        return false
      }
      if (
        filter.containerName != null &&
        container.containerName !== filter.containerName
      ) {
        return false
      }
      if (filter.state != null && container.state !== filter.state) {
        return false
      }
      return true
    })
  }

  const getContainerCount = (): number => {
    return containers.size
  }

  return {
    runtimeName,
    runtimeVersion,
    getRuntimeId,
    startContainer,
    stopContainer,
    getContainer,
    listContainers,
    getContainerCount
  }
}
