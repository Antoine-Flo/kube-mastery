import type { ApiServerFacade } from '../api/ApiServerFacade'
import type { StorageClass } from '../cluster/ressources/StorageClass'

const findStorageClassByName = (
  apiServer: ApiServerFacade,
  storageClassName: string
): StorageClass | undefined => {
  const storageClassResult = apiServer.findResource(
    'StorageClass',
    storageClassName
  )
  if (!storageClassResult.ok) {
    return undefined
  }
  return storageClassResult.value
}

export const hasWaitForFirstConsumerBindingMode = (
  apiServer: ApiServerFacade,
  storageClassName: string | undefined
): boolean => {
  if (storageClassName == null || storageClassName.length === 0) {
    return false
  }
  const storageClass = findStorageClassByName(apiServer, storageClassName)
  if (storageClass == null) {
    return false
  }
  return storageClass.volumeBindingMode === 'WaitForFirstConsumer'
}

export const hasPodConsumerForClaim = (
  apiServer: ApiServerFacade,
  namespace: string,
  claimName: string
): boolean => {
  const pods = apiServer.listResources('Pod', namespace)
  for (const pod of pods) {
    const scheduledNodeName = pod.spec.nodeName
    if (scheduledNodeName == null || scheduledNodeName.length === 0) {
      continue
    }
    if (pod.metadata.deletionTimestamp != null) {
      continue
    }
    const volumes = pod.spec.volumes ?? []
    for (const volume of volumes) {
      if (volume.source.type !== 'persistentVolumeClaim') {
        continue
      }
      if (volume.source.claimName === claimName) {
        return true
      }
    }
  }
  return false
}
