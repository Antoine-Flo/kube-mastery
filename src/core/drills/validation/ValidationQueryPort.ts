import type { ResourceKind } from '../../cluster/generated/clusterResourceTypes.generated'
import type { Result } from '../../shared/result'

export interface ValidationQueryPort {
  findClusterResource(
    kind: ResourceKind,
    name: string,
    namespace?: string
  ): Result<unknown>
  listClusterResources(kind: ResourceKind, namespace?: string): unknown[]
  readFile(path: string): Result<string>
}
