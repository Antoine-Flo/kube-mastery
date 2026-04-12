import { z } from 'zod'
import type {
  K8sPersistentVolumeClaim,
  K8sPersistentVolumeClaimMetadata,
  K8sPersistentVolumeClaimSpec,
  K8sPersistentVolumeClaimStatus
} from '../../openapi/generated/k8sOpenapiAliases.generated'
import { deepFreeze } from '../../shared/deepFreeze'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { NamespacedFactoryConfigBase } from './resourceFactoryConfig'

export type PersistentVolumeClaimPhase = 'Pending' | 'Bound' | 'Lost'

export interface PersistentVolumeClaimSpec extends Pick<
  K8sPersistentVolumeClaimSpec,
  'accessModes' | 'resources' | 'storageClassName' | 'volumeName'
> {
  accessModes: Array<
    'ReadWriteOnce' | 'ReadOnlyMany' | 'ReadWriteMany' | 'ReadWriteOncePod'
  >
  resources: {
    requests: {
      storage: string
    }
  }
  storageClassName?: string
  volumeName?: string
}

export type PersistentVolumeClaimStatus = Pick<
  K8sPersistentVolumeClaimStatus,
  'phase' | 'accessModes' | 'capacity'
> & {
  phase: PersistentVolumeClaimPhase
  accessModes?: Array<
    'ReadWriteOnce' | 'ReadOnlyMany' | 'ReadWriteMany' | 'ReadWriteOncePod'
  >
  capacity?: {
    storage: string
  }
}

type PersistentVolumeClaimMetadata = Pick<
  K8sPersistentVolumeClaimMetadata,
  'name' | 'namespace' | 'labels' | 'annotations' | 'creationTimestamp'
>

export type PersistentVolumeClaim = Omit<
  K8sPersistentVolumeClaim,
  'metadata' | 'spec' | 'status'
> & {
  metadata: PersistentVolumeClaimMetadata
  spec: PersistentVolumeClaimSpec
  status: PersistentVolumeClaimStatus
}

interface PersistentVolumeClaimConfig extends NamespacedFactoryConfigBase {
  spec: PersistentVolumeClaimSpec
  status?: PersistentVolumeClaimStatus
}

export const createPersistentVolumeClaim = (
  config: PersistentVolumeClaimConfig
): PersistentVolumeClaim => {
  const persistentVolumeClaim: PersistentVolumeClaim = {
    apiVersion: 'v1',
    kind: 'PersistentVolumeClaim',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp: config.creationTimestamp || new Date().toISOString(),
      ...(config.labels && { labels: config.labels }),
      ...(config.annotations && { annotations: config.annotations })
    },
    spec: config.spec,
    status: config.status ?? {
      phase: config.spec.volumeName == null ? 'Pending' : 'Bound'
    }
  }

  return deepFreeze(persistentVolumeClaim)
}

const PersistentVolumeClaimManifestSchema = z.object({
  apiVersion: z.literal('v1'),
  kind: z.literal('PersistentVolumeClaim'),
  metadata: z.object({
    name: z.string().min(1, 'PersistentVolumeClaim name is required'),
    namespace: z.string().default('default'),
    labels: z.record(z.string(), z.string()).optional(),
    annotations: z.record(z.string(), z.string()).optional(),
    creationTimestamp: z.string().optional()
  }),
  spec: z.object({
    accessModes: z
      .array(
        z.enum([
          'ReadWriteOnce',
          'ReadOnlyMany',
          'ReadWriteMany',
          'ReadWriteOncePod'
        ])
      )
      .min(1, 'PersistentVolumeClaim accessModes is required'),
    resources: z.object({
      requests: z.object({
        storage: z
          .string()
          .min(
            1,
            'PersistentVolumeClaim resources.requests.storage is required'
          )
      })
    }),
    storageClassName: z.string().optional(),
    volumeName: z.string().optional()
  }),
  status: z
    .object({
      phase: z.enum(['Pending', 'Bound', 'Lost']).optional()
    })
    .optional()
})

export const parsePersistentVolumeClaimManifest = (
  data: unknown
): Result<PersistentVolumeClaim> => {
  const result = PersistentVolumeClaimManifestSchema.safeParse(data)
  if (!result.success) {
    const firstError = result.error.issues[0]
    return error(
      `Invalid PersistentVolumeClaim manifest: ${firstError.path.join('.')}: ${firstError.message}`
    )
  }

  const manifest = result.data
  return success(
    createPersistentVolumeClaim({
      name: manifest.metadata.name,
      namespace: manifest.metadata.namespace,
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
