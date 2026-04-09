import type { ClusterStateData } from '../../cluster/ClusterState'
import type { DeploymentLifecycleDescribeEvent } from '../../api/DeploymentLifecycleEventStore'
import type { PersistentVolumeClaimLifecycleDescribeEvent } from '../../api/PersistentVolumeClaimLifecycleEventStore'
import type { PodLifecycleDescribeEvent } from '../../api/PodLifecycleEventStore'

/**
 * Mirrors describe.DescriberSettings in refs/k8s/kubectl/pkg/describe/interface.go
 */
export interface DescriberSettings {
  showEvents: boolean
  chunkSize: number
}

export const defaultDescriberSettings = (): DescriberSettings => {
  return {
    showEvents: true,
    chunkSize: 500
  }
}

/**
 * Dependencies injected by the command handler (event stores), not in upstream DescriberSettings.
 */
export interface DescribeDependencies {
  listPodEvents?: (
    namespace: string,
    podName: string
  ) => readonly PodLifecycleDescribeEvent[]
  listDeploymentEvents?: (
    namespace: string,
    deploymentName: string
  ) => readonly DeploymentLifecycleDescribeEvent[]
  listPersistentVolumeClaimEvents?: (
    namespace: string,
    persistentVolumeClaimName: string
  ) => readonly PersistentVolumeClaimLifecycleDescribeEvent[]
}

/**
 * Context passed to resource describers. Upstream kubectl fetches objects inside Describe();
 * the simulation passes the already-resolved resource plus cluster snapshot.
 */
export interface DescribeContext {
  state: ClusterStateData | undefined
  settings: DescriberSettings
  dependencies: DescribeDependencies
}
