import type { ApiServerFacade } from '../api/ApiServerFacade'
import {
  initializeControlPlane,
  stopControlPlane,
  type ControlPlaneControllers,
  type InitializeControlPlaneOptions
} from './initializers'
import {
  createKubeletNodeManager,
  type KubeletNodeManager
} from '../kubelet/KubeletNodeManager'
import {
  createContainerRuntimeSimulator,
  type ContainerRuntimeSimulator
} from '../runtime/ContainerRuntimeSimulator'

export interface ControlPlaneRuntime {
  readonly runtimeControllers: ControlPlaneControllers
  readonly kubeletNode: KubeletNodeManager
  readonly containerRuntime: ContainerRuntimeSimulator
  stop: () => void
}

const syncNodeRuntimeVersion = (
  apiServer: ApiServerFacade,
  runtime: ContainerRuntimeSimulator
): void => {
  const runtimeId = runtime.getRuntimeId()
  const nodes = apiServer.listResources('Node')
  for (const node of nodes) {
    if (node.status.nodeInfo.containerRuntimeVersion === runtimeId) {
      continue
    }
    const updatedNode = {
      ...node,
      status: {
        ...node.status,
        nodeInfo: {
          ...node.status.nodeInfo,
          containerRuntimeVersion: runtimeId
        }
      }
    }
    apiServer.updateResource('Node', node.metadata.name, updatedNode)
  }
}

export const startControlPlaneRuntime = (
  apiServer: ApiServerFacade,
  options: InitializeControlPlaneOptions = {}
): ControlPlaneRuntime => {
  const containerRuntime = createContainerRuntimeSimulator()
  const runtimeControllers = initializeControlPlane(apiServer, {
    ...options,
    podLifecycle: {
      ...options.podLifecycle,
      containerRuntime
    }
  })
  syncNodeRuntimeVersion(apiServer, containerRuntime)
  const initialNodeNames = apiServer.listResources('Node').map((node) => {
    return node.metadata.name
  })
  const kubeletNode = createKubeletNodeManager(
    runtimeControllers,
    containerRuntime,
    { initialNodeNames }
  )
  return {
    runtimeControllers,
    kubeletNode,
    containerRuntime,
    stop: () => {
      kubeletNode.stop()
      stopControlPlane(runtimeControllers)
    }
  }
}
