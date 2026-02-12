import type { ClusterState } from '../../src/core/cluster/ClusterState'
import { createEventBus } from '../../src/core/cluster/events/EventBus'
import { loadClusterStateFromSeedPath } from '../../src/core/cluster/seeds/loader'
import { createKubectlExecutor } from '../../src/core/kubectl/commands/executor'
import { createLogger } from '../../src/logger/Logger'
import { createSeedFileSystem } from './seed-filesystem'

export interface SimulatorRunner {
  execute(command: string): string
}

export const createSimulatorRunner = (seedPath: string): SimulatorRunner => {
  const loadResult = loadClusterStateFromSeedPath(seedPath)
  if (!loadResult.ok) {
    throw new Error(loadResult.error)
  }
  const clusterState = loadResult.value
  const fileSystem = createSeedFileSystem(seedPath)
  const logger = createLogger({ mirrorToConsole: false })
  const eventBus = createEventBus()
  const executor = createKubectlExecutor(
    clusterState,
    fileSystem,
    logger,
    eventBus
  )
  return {
    execute(command: string): string {
      const result = executor.execute(command)
      return result.ok ? (result.value ?? '') : result.error
    }
  }
}
