import type { StorageClass } from '../../../cluster/ressources/StorageClass'

export const describeStorageClass = (storageClass: StorageClass): string => {
  const formatStorageClassAnnotations = (): string => {
    const annotations = storageClass.metadata.annotations
    if (annotations == null || Object.keys(annotations).length === 0) {
      return '<none>'
    }
    const entries = Object.entries(annotations)
    const [firstKey, firstValue] = entries[0]
    const firstEntry = `${firstKey}=${firstValue}`
    const additionalEntries = entries
      .slice(1)
      .map(([key, value]) => `,${key}=${value}`)
      .join('\n')
    if (additionalEntries.length === 0) {
      return firstEntry
    }
    return `${firstEntry}\n${additionalEntries}`
  }

  const lines: string[] = []
  lines.push(`Name:            ${storageClass.metadata.name}`)
  lines.push(
    `IsDefaultClass:  ${storageClass.metadata.annotations?.['storageclass.kubernetes.io/is-default-class'] === 'true' ? 'Yes' : 'No'}`
  )
  lines.push(`Annotations:     ${formatStorageClassAnnotations()}`)
  lines.push(`Provisioner:           ${storageClass.provisioner}`)
  lines.push('Parameters:            <none>')
  lines.push(
    `AllowVolumeExpansion:  ${storageClass.allowVolumeExpansion == null ? '<unset>' : storageClass.allowVolumeExpansion ? 'True' : 'False'}`
  )
  lines.push('MountOptions:          <none>')
  lines.push(`ReclaimPolicy:         ${storageClass.reclaimPolicy}`)
  lines.push(`VolumeBindingMode:     ${storageClass.volumeBindingMode}`)
  lines.push('Events:                <none>')
  return lines.join('\n')
}
