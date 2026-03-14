import type { ApiServerFacade } from '../../api/ApiServerFacade'
import type { ControllerState } from './types'

export const createControllerStateFromApi = (
  apiServer: ApiServerFacade
): ControllerState => {
  return {
    getDeployments: (namespace?: string) => {
      return apiServer.listResources('Deployment', namespace)
    },
    findDeployment: (name: string, namespace: string) => {
      return apiServer.findResource('Deployment', name, namespace)
    },
    getDaemonSets: (namespace?: string) => {
      return apiServer.listResources('DaemonSet', namespace)
    },
    findDaemonSet: (name: string, namespace: string) => {
      return apiServer.findResource('DaemonSet', name, namespace)
    },
    getReplicaSets: (namespace?: string) => {
      return apiServer.listResources('ReplicaSet', namespace)
    },
    findReplicaSet: (name: string, namespace: string) => {
      return apiServer.findResource('ReplicaSet', name, namespace)
    },
    getPods: (namespace?: string) => {
      return apiServer.listResources('Pod', namespace)
    },
    findPod: (name: string, namespace: string) => {
      return apiServer.findResource('Pod', name, namespace)
    },
    getNodes: () => {
      return apiServer.listResources('Node')
    },
    getPersistentVolumes: () => {
      return apiServer.listResources('PersistentVolume')
    },
    findPersistentVolume: (name: string) => {
      return apiServer.findResource('PersistentVolume', name)
    },
    getPersistentVolumeClaims: (namespace?: string) => {
      return apiServer.listResources('PersistentVolumeClaim', namespace)
    },
    findPersistentVolumeClaim: (name: string, namespace: string) => {
      return apiServer.findResource('PersistentVolumeClaim', name, namespace)
    }
  }
}
