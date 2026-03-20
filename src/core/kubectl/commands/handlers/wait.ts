import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { Pod } from '../../../cluster/ressources/Pod'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import type { ParsedCommand } from '../types'

// kubectl wait: only pods and condition=Ready are supported for conformance

const isPodReady = (pod: Pod): boolean => {
  if (pod.status.phase !== 'Running') {
    return false
  }
  const statuses = pod.status.containerStatuses ?? []
  const regularNames = new Set(pod.spec.containers.map((c) => c.name))
  const regularStatuses = statuses.filter((s) => regularNames.has(s.name))
  if (regularStatuses.length === 0) {
    return false
  }
  return regularStatuses.every((s) => s.ready === true)
}

/**
 * Handle kubectl wait command.
 * Supports: kubectl wait --for=condition=Ready pod/<name> [--timeout=60s]
 * When reconcileForWait is provided (e.g. from conformance runner), runs reconciliation
 * in a loop until the pod is Ready or timeout.
 */
export const handleWait = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand,
  reconcileForWait?: (namespace?: string) => void
): ExecutionResult => {
  if (parsed.resource !== 'pods') {
    return error('error: wait is only supported for pods')
  }
  if (!parsed.name || parsed.name.length === 0) {
    return error('error: wait requires a resource name')
  }
  const waitForCondition = parsed.waitForCondition ?? 'condition=Ready'
  if (!waitForCondition.includes('condition=Ready')) {
    return error('error: wait only supports --for=condition=Ready')
  }

  const namespace = parsed.namespace ?? 'default'
  const timeoutSeconds = parsed.waitTimeoutSeconds ?? 60
  const resourceKey = `pod/${parsed.name}`

  const maxIterations = Math.max(1, Math.min(timeoutSeconds, 120))

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (reconcileForWait !== undefined) {
      reconcileForWait(namespace)
    }

    const podResult = apiServer.findResource('Pod', parsed.name, namespace)
    if (!podResult.ok) {
      return error(`error: no matching resources found`)
    }

    const pod = podResult.value as Pod
    if (isPodReady(pod)) {
      return success(`${resourceKey} condition met`)
    }
  }

  return error(`error: timed out waiting for condition on ${resourceKey}`)
}
