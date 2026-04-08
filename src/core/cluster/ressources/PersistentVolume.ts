import { z } from 'zod'
import type {
  K8sPersistentVolume,
  K8sPersistentVolumeMetadata,
  K8sPersistentVolumeSpec,
  K8sPersistentVolumeStatus
} from '../../openapi/generated/k8sOpenapiAliases.generated'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { ClusterScopedNameFactoryConfigBase } from './resourceFactoryConfig'

export type PersistentVolumePhase =
  | 'Available'
  | 'Bound'
  | 'Released'
  | 'Failed'

export interface PersistentVolumeSpec
  extends Pick<
    K8sPersistentVolumeSpec,
    'capacity' | 'accessModes' | 'storageClassName' | 'claimRef'
  > {
  capacity: {
    storage: string
  }
  accessModes: Array<
    'ReadWriteOnce' | 'ReadOnlyMany' | 'ReadWriteMany' | 'ReadWriteOncePod'
  >
  storageClassName?: string
  persistentVolumeReclaimPolicy?: 'Retain' | 'Recycle' | 'Delete'
  hostPath?: {
    path: string
    type?: string
  }
  claimRef?: {
    namespace: string
    name: string
  }
}

export type PersistentVolumeStatus = Pick<K8sPersistentVolumeStatus, 'phase'> & {
  phase: PersistentVolumePhase
}

type PersistentVolumeMetadata = Pick<
  K8sPersistentVolumeMetadata,
  'name' | 'namespace' | 'labels' | 'annotations' | 'creationTimestamp'
> & { namespace: '' }

export type PersistentVolume = Omit<
  K8sPersistentVolume,
  'metadata' | 'spec' | 'status'
> & {
  metadata: PersistentVolumeMetadata
  spec: PersistentVolumeSpec
  status: PersistentVolumeStatus
}

interface PersistentVolumeConfig extends ClusterScopedNameFactoryConfigBase {
  spec: PersistentVolumeSpec
  status?: PersistentVolumeStatus
}

export const createPersistentVolume = (
  config: PersistentVolumeConfig
): PersistentVolume => {
  const persistentVolume: PersistentVolume = {
    apiVersion: 'v1',
    kind: 'PersistentVolume',
    metadata: {
      name: config.name,
      namespace: '',
      creationTimestamp: config.creationTimestamp || new Date().toISOString(),
      ...(config.labels && { labels: config.labels }),
      ...(config.annotations && { annotations: config.annotations })
    },
    spec: config.spec,
    status: config.status ?? {
      phase: config.spec.claimRef == null ? 'Available' : 'Bound'
    }
  }

  return deepFreeze(persistentVolume)
}

const PersistentVolumeManifestSchema = z.object({
  apiVersion: z.literal('v1'),
  kind: z.literal('PersistentVolume'),
  metadata: z.object({
    name: z.string().min(1, 'PersistentVolume name is required'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  spec: z.object({
    capacity: z.object({
      storage: z
        .string()
        .min(1, 'PersistentVolume capacity.storage is required')
    }),
    accessModes: z
      .array(
        z.enum([
          'ReadWriteOnce',
          'ReadOnlyMany',
          'ReadWriteMany',
          'ReadWriteOncePod'
        ])
      )
      .min(1, 'PersistentVolume accessModes is required'),
    storageClassName: z.string().optional(),
    persistentVolumeReclaimPolicy: z
      .enum(['Retain', 'Recycle', 'Delete'])
      .optional(),
    hostPath: z
      .object({
        path: z.string().min(1),
        type: z.string().optional()
      })
      .optional(),
    claimRef: z
      .object({
        namespace: z.string().min(1),
        name: z.string().min(1)
      })
      .optional()
  }),
  status: z
    .object({
      phase: z.enum(['Available', 'Bound', 'Released', 'Failed']).optional()
    })
    .optional()
})

export const parsePersistentVolumeManifest = (
  data: unknown
): Result<PersistentVolume> => {
  const result = PersistentVolumeManifestSchema.safeParse(data)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return error(
      `Invalid PersistentVolume manifest: ${firstError.path.join('.')}: ${firstError.message}`
    )
  }

  const manifest = result.data
  return success(
    createPersistentVolume({
      name: manifest.metadata.name,
      spec: manifest.spec,
      ...(manifest.metadata.labels && { labels: manifest.metadata.labels }),
      ...(manifest.metadata.annotations && {
        annotations: manifest.metadata.annotations
      }),
      ...(manifest.metadata.creationTimestamp && {
        creationTimestamp: manifest.metadata.creationTimestamp
      }),
      ...(manifest.status?.phase && {
        status: { phase: manifest.status.phase }
      })
    })
  )
}
