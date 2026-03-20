import type { ClusterStateData } from '../../../../../cluster/ClusterState'
import type { Resource } from '../../../types'

export interface ResourceWithMetadata {
  metadata: {
    name: string
    namespace: string
    labels?: Record<string, string>
  }
}

export interface ResourceHandler<T extends ResourceWithMetadata> {
  getItems: (state: ClusterStateData) => T[]
  headers: string[]
  formatRow: (item: T) => string[]
  supportsFiltering: boolean
  isClusterScoped?: boolean
  formatRowWide?: (item: T) => string[]
  headersWide?: string[]
  align?: ('left' | 'right')[]
}

export interface ResourceOutputMetadata {
  apiVersion: string
  kind: string
}

export type StructuredResource = Exclude<Resource, 'all'>

export interface ResourceListOutput<T> {
  apiVersion: string
  items: T[]
  kind: string
  metadata: {
    resourceVersion: string
  }
}

export const KUBECTL_TABLE_SPACING = 3

export const withKubectlTableSpacing = (options?: {
  align?: ('left' | 'right')[]
}): { spacing: number; align?: ('left' | 'right')[] } => {
  if (options?.align != null) {
    return {
      spacing: KUBECTL_TABLE_SPACING,
      align: options.align
    }
  }
  return {
    spacing: KUBECTL_TABLE_SPACING
  }
}

export const buildLeftAlign = (columnsCount: number): ('left' | 'right')[] => {
  return Array.from({ length: columnsCount }, () => 'left')
}
