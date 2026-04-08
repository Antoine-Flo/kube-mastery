import type { ResourceKind } from '../../../../../cluster/ClusterState'
import type { Resource } from '../../../types'

export type NamespacedEventDeleteResource = 'pods' | 'configmaps' | 'secrets'

export interface NamespacedDeleteConfig {
  kind: ResourceKind
  kindRef: string
}

export type DeleteManifestTargetConfig = {
  kind: ResourceKind
  kindRef: string
  kindRefPlural: string
  namespaced: boolean
}

export type PodDeleteOptions = {
  gracePeriodSeconds?: number
  force?: boolean
}

export type DeletableResource = Exclude<Resource, 'all'>
