import { deepFreeze } from '../../shared/deepFreeze'
import type { components } from '../../openapi/generated/openapi-types.generated'
import type {
  K8sControllerRevision,
  K8sControllerRevisionMetadata
} from '../../openapi/generated/k8sOpenapiAliases.generated'
import type { NamespacedFactoryConfigBase } from './resourceFactoryConfig'

export type ControllerRevisionOwnerReference =
  components['schemas']['io.k8s.apimachinery.pkg.apis.meta.v1.OwnerReference']

type ControllerRevisionMetadata = Pick<
  K8sControllerRevisionMetadata,
  | 'name'
  | 'namespace'
  | 'labels'
  | 'annotations'
  | 'creationTimestamp'
  | 'ownerReferences'
>

export type ControllerRevision = Omit<
  K8sControllerRevision,
  'metadata' | 'data'
> & {
  metadata: ControllerRevisionMetadata
  data: {
    template: unknown
  }
}

interface CreateControllerRevisionConfig extends NamespacedFactoryConfigBase {
  revision: number
  template: unknown
  ownerReferences?: ControllerRevisionOwnerReference[]
}

export const createControllerRevision = (
  config: CreateControllerRevisionConfig
): ControllerRevision => {
  const controllerRevision: ControllerRevision = {
    apiVersion: 'apps/v1',
    kind: 'ControllerRevision',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp: config.creationTimestamp ?? new Date().toISOString(),
      ...(config.labels != null && { labels: config.labels }),
      ...(config.annotations != null && { annotations: config.annotations }),
      ...(config.ownerReferences != null && {
        ownerReferences: config.ownerReferences
      })
    },
    revision: config.revision,
    data: {
      template: config.template
    }
  }

  return deepFreeze(controllerRevision)
}
