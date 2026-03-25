import { deepFreeze } from '../../shared/deepFreeze'
import type { KubernetesResource } from '../repositories/types'

export interface ControllerRevisionOwnerReference {
  apiVersion: string
  kind: string
  name: string
  uid: string
  controller?: boolean
  blockOwnerDeletion?: boolean
}

interface ControllerRevisionMetadata {
  name: string
  namespace: string
  labels?: Record<string, string>
  annotations?: Record<string, string>
  creationTimestamp: string
  ownerReferences?: ControllerRevisionOwnerReference[]
}

export interface ControllerRevision extends KubernetesResource {
  apiVersion: 'apps/v1'
  kind: 'ControllerRevision'
  metadata: ControllerRevisionMetadata
  revision: number
  data: {
    template: unknown
  }
}

interface CreateControllerRevisionConfig {
  name: string
  namespace: string
  revision: number
  template: unknown
  labels?: Record<string, string>
  annotations?: Record<string, string>
  ownerReferences?: ControllerRevisionOwnerReference[]
  creationTimestamp?: string
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
