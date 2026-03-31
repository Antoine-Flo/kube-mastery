import { z } from 'zod'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { KubernetesResource } from '../repositories/types'

export interface StorageClassSpec {
  provisioner: string
  reclaimPolicy?: 'Delete' | 'Retain'
  volumeBindingMode?: 'Immediate' | 'WaitForFirstConsumer'
  allowVolumeExpansion?: boolean
  parameters?: Record<string, string>
}

interface StorageClassMetadata {
  name: string
  namespace: ''
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp: string
}

export interface StorageClass extends KubernetesResource {
  apiVersion: 'storage.k8s.io/v1'
  kind: 'StorageClass'
  metadata: StorageClassMetadata
  provisioner: string
  reclaimPolicy: 'Delete' | 'Retain'
  volumeBindingMode: 'Immediate' | 'WaitForFirstConsumer'
  allowVolumeExpansion?: boolean
  parameters?: Record<string, string>
}

interface StorageClassConfig {
  name: string
  spec: StorageClassSpec
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp?: string
}

export const createStorageClass = (config: StorageClassConfig): StorageClass => {
  const storageClass: StorageClass = {
    apiVersion: 'storage.k8s.io/v1',
    kind: 'StorageClass',
    metadata: {
      name: config.name,
      namespace: '',
      creationTimestamp: config.creationTimestamp ?? new Date().toISOString(),
      ...(config.labels != null ? { labels: config.labels } : {}),
      ...(config.annotations != null ? { annotations: config.annotations } : {})
    },
    provisioner: config.spec.provisioner,
    reclaimPolicy: config.spec.reclaimPolicy ?? 'Delete',
    volumeBindingMode: config.spec.volumeBindingMode ?? 'Immediate',
    ...(config.spec.allowVolumeExpansion != null
      ? { allowVolumeExpansion: config.spec.allowVolumeExpansion }
      : {}),
    ...(config.spec.parameters != null ? { parameters: config.spec.parameters } : {})
  }
  return deepFreeze(storageClass)
}

const StorageClassManifestSchema = z.object({
  apiVersion: z.literal('storage.k8s.io/v1'),
  kind: z.literal('StorageClass'),
  metadata: z.object({
    name: z.string().min(1, 'StorageClass name is required'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  provisioner: z.string().min(1, 'StorageClass provisioner is required'),
  reclaimPolicy: z.enum(['Delete', 'Retain']).optional(),
  volumeBindingMode: z.enum(['Immediate', 'WaitForFirstConsumer']).optional(),
  allowVolumeExpansion: z.boolean().optional(),
  parameters: z.record(z.string(), z.string()).optional()
})

export const parseStorageClassManifest = (data: unknown): Result<StorageClass> => {
  const result = StorageClassManifestSchema.safeParse(data)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return error(
      `Invalid StorageClass manifest: ${firstError.path.join('.')}: ${firstError.message}`
    )
  }

  const manifest = result.data
  return success(
    createStorageClass({
      name: manifest.metadata.name,
      spec: {
        provisioner: manifest.provisioner,
        reclaimPolicy: manifest.reclaimPolicy,
        volumeBindingMode: manifest.volumeBindingMode,
        allowVolumeExpansion: manifest.allowVolumeExpansion,
        parameters: manifest.parameters
      },
      ...(manifest.metadata.labels != null ? { labels: manifest.metadata.labels } : {}),
      ...(manifest.metadata.annotations != null
        ? { annotations: manifest.metadata.annotations }
        : {}),
      ...(manifest.metadata.creationTimestamp != null
        ? { creationTimestamp: manifest.metadata.creationTimestamp }
        : {})
    })
  )
}
