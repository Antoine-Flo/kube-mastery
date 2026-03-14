import type { Controller } from '../control-plane/controller-runtime/types'
import type { ControlPlaneControllers } from '../control-plane/initializers'
import type {
  ContainerRuntimeSimulator,
  RuntimeContainerRecord
} from '../runtime/ContainerRuntimeSimulator'

export interface CreateKubeletNodeManagerOptions {
  initialNodeNames?: string[]
}

export interface KubeletNodeManager {
  readonly runtime: ContainerRuntimeSimulator
  readonly podLifecycleController: Controller
  ensureNode: (nodeName: string) => void
  hasNode: (nodeName: string) => boolean
  listNodes: () => string[]
  listNodeContainers: (nodeName: string) => RuntimeContainerRecord[]
  stop: () => void
}

export const createKubeletNodeManager = (
  runtimeControllers: ControlPlaneControllers,
  runtime: ContainerRuntimeSimulator,
  options: CreateKubeletNodeManagerOptions = {}
): KubeletNodeManager => {
  const nodeNames = new Set(options.initialNodeNames ?? [])

  const ensureNode = (nodeName: string): void => {
    nodeNames.add(nodeName)
  }

  const hasNode = (nodeName: string): boolean => {
    return nodeNames.has(nodeName)
  }

  const listNodes = (): string[] => {
    return [...nodeNames].sort((left, right) => {
      return left.localeCompare(right)
    })
  }

  const listNodeContainers = (nodeName: string): RuntimeContainerRecord[] => {
    if (!nodeNames.has(nodeName)) {
      return []
    }
    return runtime.listContainers({ nodeName })
  }

  const stop = (): void => {
    nodeNames.clear()
  }

  return {
    runtime,
    podLifecycleController: runtimeControllers.podLifecycleController,
    ensureNode,
    hasNode,
    listNodes,
    listNodeContainers,
    stop
  }
}
