import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { Pod } from '../../../cluster/ressources/Pod'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import type { ParsedCommand } from '../types'
import { buildRequiresResourceNameMessage } from '../shared/errorMessages'

// kubectl wait: only pods and condition=Ready are supported for conformance
const DEFAULT_WAIT_CONDITION = 'condition=Ready'
const DEFAULT_TIMEOUT_SECONDS = 60
const MAX_TIMEOUT_SECONDS = 120

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

const validateWaitRequest = (parsed: ParsedCommand): string | undefined => {
  if (parsed.resource !== 'pods') {
    return 'error: wait is only supported for pods'
  }
  if (!parsed.name || parsed.name.length === 0) {
    return buildRequiresResourceNameMessage('wait')
  }
  const waitForCondition = parsed.waitForCondition ?? DEFAULT_WAIT_CONDITION
  if (!waitForCondition.includes(DEFAULT_WAIT_CONDITION)) {
    return 'error: wait only supports --for=condition=Ready'
  }
  return undefined
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
  const validationError = validateWaitRequest(parsed)
  if (validationError != null) {
    return error(validationError)
  }

  const podName = parsed.name
  if (podName == null || podName.length === 0) {
    return error(buildRequiresResourceNameMessage('wait'))
  }

  const namespace = parsed.namespace ?? 'default'
  const timeoutSeconds = parsed.waitTimeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS
  const resourceKey = `pod/${podName}`

  const maxIterations = Math.max(1, Math.min(timeoutSeconds, MAX_TIMEOUT_SECONDS))

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (reconcileForWait !== undefined) {
      reconcileForWait(namespace)
    }

    const podResult = apiServer.findResource('Pod', podName, namespace)
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
