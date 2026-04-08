import type { Result } from '../shared/result'
import type { ClusterStateData } from './generated/clusterResourceTypes.generated'
import { createResourceRepository } from './repositories/resourceRepository'
import type {
  KubernetesResource,
  ResourceCollection
} from './repositories/types'

export type ResourceRepository<T extends KubernetesResource> = ReturnType<
  typeof createResourceRepository<T>
>

export interface ResourceOperations<T extends KubernetesResource> {
  add: (state: ClusterStateData, resource: T) => ClusterStateData
  getAll: (state: ClusterStateData, namespace?: string) => T[]
  find: (state: ClusterStateData, name: string, namespace: string) => Result<T>
  delete: (
    state: ClusterStateData,
    name: string,
    namespace: string
  ) => Result<T> & { state?: ClusterStateData }
  update: (
    state: ClusterStateData,
    name: string,
    namespace: string,
    updateFn: (resource: T) => T
  ) => Result<T> & { state?: ClusterStateData }
}

export const createResourceOperations = <T extends KubernetesResource>(
  repo: ResourceRepository<T>,
  collectionKey: keyof ClusterStateData
): ResourceOperations<T> => ({
  add: (state: ClusterStateData, resource: T): ClusterStateData => ({
    ...state,
    [collectionKey]: repo.add(
      state[collectionKey] as unknown as ResourceCollection<T>,
      resource
    )
  }),

  getAll: (state: ClusterStateData, namespace?: string): T[] =>
    repo.getAll(
      state[collectionKey] as unknown as ResourceCollection<T>,
      namespace
    ),

  find: (state: ClusterStateData, name: string, namespace: string): Result<T> =>
    repo.find(
      state[collectionKey] as unknown as ResourceCollection<T>,
      name,
      namespace
    ),

  delete: (
    state: ClusterStateData,
    name: string,
    namespace: string
  ): Result<T> & { state?: ClusterStateData } => {
    const result = repo.remove(
      state[collectionKey] as unknown as ResourceCollection<T>,
      name,
      namespace
    )
    if (result.ok && result.collection) {
      return {
        ok: true,
        value: result.value,
        state: { ...state, [collectionKey]: result.collection }
      }
    }
    return result
  },

  update: (
    state: ClusterStateData,
    name: string,
    namespace: string,
    updateFn: (resource: T) => T
  ): Result<T> & { state?: ClusterStateData } => {
    const result = repo.update(
      state[collectionKey] as unknown as ResourceCollection<T>,
      name,
      namespace,
      updateFn
    )
    if (result.ok && result.collection) {
      return {
        ok: true,
        value: result.value,
        state: { ...state, [collectionKey]: result.collection }
      }
    }
    return result
  }
})
