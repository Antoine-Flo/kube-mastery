import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import {
  createDeploymentUpdatedEvent,
  createReplicaSetUpdatedEvent
} from '../../../cluster/events/types'
import type { Deployment } from '../../../cluster/ressources/Deployment'
import type { ReplicaSet } from '../../../cluster/ressources/ReplicaSet'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import type { ParsedCommand } from '../types'
import {
  isDryRunRequested,
  isSupportedDryRunValue
} from './internal/create/dryRunResponse'

// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL SCALE HANDLER
// ═══════════════════════════════════════════════════════════════════════════
// Handle kubectl scale command for deployments and replicasets
// Uses event-driven architecture to trigger controller reconciliation

// Scalable resources
const SCALABLE_RESOURCES = ['deployments', 'replicasets'] as const

/**
 * Handle kubectl scale command
 * Supports: kubectl scale deployment/name --replicas=N
 *           kubectl scale deployment name --replicas=N
 */
export const handleScale = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ExecutionResult => {
  const dryRunFlag = parsed.flags['dry-run']
  if (!isSupportedDryRunValue(dryRunFlag)) {
    return error(
      `error: Invalid dry-run value (${String(dryRunFlag)}). Must be "none", "server", or "client".`
    )
  }
  const namespace = parsed.namespace || 'default'
  const { resource, name, replicas } = parsed

  // Validate replicas flag
  if (replicas === undefined) {
    return error(
      'The --replicas=COUNT flag is required, and COUNT must be greater than or equal to 0'
    )
  }

  if (replicas < 0) {
    return error(
      'The --replicas=COUNT flag is required, and COUNT must be greater than or equal to 0'
    )
  }

  // Validate resource name
  if (!name) {
    return error('error: you must specify the name of the resource to scale')
  }

  // Validate resource type is scalable
  if (
    !resource ||
    !SCALABLE_RESOURCES.includes(
      resource as (typeof SCALABLE_RESOURCES)[number]
    )
  ) {
    return error(`error: the resource type "${resource}" is not scalable`)
  }

  // Scale deployment
  if (resource === 'deployments') {
    return scaleDeployment(
      apiServer,
      name,
      namespace,
      replicas,
      isDryRunRequested(parsed)
    )
  }

  // Scale replicaset
  if (resource === 'replicasets') {
    return scaleReplicaSet(
      apiServer,
      name,
      namespace,
      replicas,
      isDryRunRequested(parsed)
    )
  }

  return error(`error: the resource type "${resource}" is not scalable`)
}

/**
 * Scale a Deployment
 */
const scaleDeployment = (
  apiServer: ApiServerFacade,
  name: string,
  namespace: string,
  replicas: number,
  dryRunRequested: boolean
): ExecutionResult => {
  const findResult = apiServer.findResource('Deployment', name, namespace)
  if (!findResult.ok) {
    return error(`deployments.apps "${name}" not found`)
  }

  const deployment = findResult.value
  const previousDeployment = deployment

  // Create updated deployment with new replicas
  const updatedDeployment: Deployment = {
    ...deployment,
    spec: {
      ...deployment.spec,
      replicas
    }
  }
  if (dryRunRequested) {
    return success(`deployment.apps/${name} scaled (dry run)`)
  }

  // Emit update event - DeploymentController will handle ReplicaSet/Pod reconciliation
  apiServer.emitEvent(
    createDeploymentUpdatedEvent(
      name,
      namespace,
      updatedDeployment,
      previousDeployment,
      'kubectl'
    )
  )

  return success(`deployment.apps/${name} scaled`)
}

/**
 * Scale a ReplicaSet
 */
const scaleReplicaSet = (
  apiServer: ApiServerFacade,
  name: string,
  namespace: string,
  replicas: number,
  dryRunRequested: boolean
): ExecutionResult => {
  const findResult = apiServer.findResource('ReplicaSet', name, namespace)
  if (!findResult.ok) {
    return error(`replicasets.apps "${name}" not found`)
  }

  const replicaSet = findResult.value
  const previousReplicaSet = replicaSet

  // Create updated replicaset with new replicas
  const updatedReplicaSet: ReplicaSet = {
    ...replicaSet,
    spec: {
      ...replicaSet.spec,
      replicas
    }
  }
  if (dryRunRequested) {
    return success(`replicaset.apps/${name} scaled (dry run)`)
  }

  // Emit update event - ReplicaSetController will handle Pod reconciliation
  apiServer.emitEvent(
    createReplicaSetUpdatedEvent(
      name,
      namespace,
      updatedReplicaSet,
      previousReplicaSet,
      'kubectl'
    )
  )

  return success(`replicaset.apps/${name} scaled`)
}
