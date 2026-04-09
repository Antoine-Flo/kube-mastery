import type { PersistentVolume } from '../../../cluster/ressources/PersistentVolume'
import { formatLabels } from '../internal/helpers'

export const describePersistentVolume = (
  persistentVolume: PersistentVolume
): string => {
  const lines: string[] = []
  lines.push(`Name:            ${persistentVolume.metadata.name}`)
  lines.push(
    `Labels:          ${formatLabels(persistentVolume.metadata.labels)}`
  )
  lines.push(
    `Annotations:     ${formatLabels(persistentVolume.metadata.annotations)}`
  )
  lines.push(
    `StorageClass:    ${persistentVolume.spec.storageClassName ?? '<none>'}`
  )
  lines.push(
    `Status:          ${persistentVolume.status.phase ?? (persistentVolume.spec.claimRef == null ? 'Available' : 'Bound')}`
  )
  lines.push(
    `Claim:           ${persistentVolume.spec.claimRef != null ? `${persistentVolume.spec.claimRef.namespace}/${persistentVolume.spec.claimRef.name}` : '<none>'}`
  )
  lines.push(
    `Reclaim Policy:  ${persistentVolume.spec.persistentVolumeReclaimPolicy ?? 'Retain'}`
  )
  lines.push(`Access Modes:    ${persistentVolume.spec.accessModes.join(',')}`)
  lines.push(`Capacity:        ${persistentVolume.spec.capacity.storage}`)
  if (persistentVolume.spec.hostPath != null) {
    lines.push(
      `Source:          HostPath (${persistentVolume.spec.hostPath.path})`
    )
  } else {
    lines.push('Source:          <none>')
  }
  lines.push('')
  lines.push('Events:          <none>')
  return lines.join('\n')
}
