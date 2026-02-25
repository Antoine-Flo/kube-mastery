import type { ClusterState } from '../../../cluster/ClusterState'
import type { EventBus } from '../../../cluster/events/EventBus'
import { createService, type ServiceSpec } from '../../../cluster/ressources/Service'
import type { ExecutionResult, Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import type { ParsedCommand } from '../types'
import { createResourceWithEvents } from './resourceHelpers'

type ExposeServiceType = NonNullable<ServiceSpec['type']>

const parseExposeServiceType = (
  rawType: string | boolean | undefined
): ExecutionResult | ExposeServiceType => {
  if (rawType == null) {
    return 'ClusterIP'
  }
  if (typeof rawType !== 'string') {
    return error('expose type must be one of: ClusterIP, NodePort, LoadBalancer')
  }
  if (
    rawType !== 'ClusterIP' &&
    rawType !== 'NodePort' &&
    rawType !== 'LoadBalancer'
  ) {
    return error('expose type must be one of: ClusterIP, NodePort, LoadBalancer')
  }
  return rawType
}

const parseNodePort = (
  rawNodePort: string | boolean | undefined
): ExecutionResult | number | undefined => {
  if (rawNodePort == null) {
    return undefined
  }
  if (typeof rawNodePort !== 'string') {
    return error('expose node-port must be a valid integer')
  }
  const parsed = Number.parseInt(rawNodePort, 10)
  if (Number.isNaN(parsed)) {
    return error('expose node-port must be a valid integer')
  }
  return parsed
}

const parseTargetPort = (
  rawTargetPort: string | boolean | undefined
): ExecutionResult | number | string | undefined => {
  if (rawTargetPort == null) {
    return undefined
  }
  if (typeof rawTargetPort !== 'string') {
    return error('expose target-port must be a value')
  }
  const parsed = Number.parseInt(rawTargetPort, 10)
  if (!Number.isNaN(parsed)) {
    return parsed
  }
  return rawTargetPort
}

const resolveSelectorFromDeployment = (
  clusterState: ClusterState,
  deploymentName: string,
  namespace: string
): Result<Record<string, string>, string> => {
  const deploymentResult = clusterState.findDeployment(deploymentName, namespace)
  if (!deploymentResult.ok) {
    return error(
      `Error from server (NotFound): deployments.apps "${deploymentName}" not found`
    )
  }
  const selector = deploymentResult.value.spec.selector.matchLabels
  if (selector == null || Object.keys(selector).length === 0) {
    return error(
      `error: deployment "${deploymentName}" has no matchLabels selector to expose`
    )
  }
  return success(selector)
}

const resolveDefaultTargetPortFromDeployment = (
  clusterState: ClusterState,
  deploymentName: string,
  namespace: string
): number | undefined => {
  const deploymentResult = clusterState.findDeployment(deploymentName, namespace)
  if (!deploymentResult.ok) {
    return undefined
  }
  const firstContainer = deploymentResult.value.spec.template.spec.containers[0]
  const firstContainerPort = firstContainer?.ports?.[0]?.containerPort
  if (typeof firstContainerPort === 'number') {
    return firstContainerPort
  }
  return undefined
}

export const handleExpose = (
  clusterState: ClusterState,
  parsed: ParsedCommand,
  eventBus: EventBus
): ExecutionResult => {
  if (!parsed.resource || !parsed.name) {
    return error('expose requires a resource type and name')
  }
  if (parsed.resource !== 'deployments') {
    return error('expose currently supports only deployment resources')
  }
  if (parsed.port == null) {
    return error('expose requires flag --port')
  }

  const namespace = parsed.namespace ?? 'default'
  const serviceNameFlag = parsed.flags.name
  const serviceName =
    typeof serviceNameFlag === 'string' && serviceNameFlag.length > 0
      ? serviceNameFlag
      : parsed.name

  const parsedType = parseExposeServiceType(parsed.flags.type)
  if (typeof parsedType !== 'string') {
    return parsedType
  }

  const parsedNodePort = parseNodePort(parsed.flags['node-port'])
  if (typeof parsedNodePort !== 'number' && parsedNodePort !== undefined) {
    return parsedNodePort
  }

  const parsedTargetPort = parseTargetPort(parsed.flags['target-port'])
  if (
    typeof parsedTargetPort !== 'number' &&
    typeof parsedTargetPort !== 'string' &&
    parsedTargetPort !== undefined
  ) {
    return parsedTargetPort
  }

  let selector: Record<string, string>
  if (parsed.selector != null) {
    selector = parsed.selector
  } else {
    const selectorResult = resolveSelectorFromDeployment(
      clusterState,
      parsed.name,
      namespace
    )
    if (!selectorResult.ok) {
      return selectorResult
    }
    selector = selectorResult.value
  }

  const defaultTargetPort = resolveDefaultTargetPortFromDeployment(
    clusterState,
    parsed.name,
    namespace
  )
  const service = createService({
    name: serviceName,
    namespace,
    selector,
    type: parsedType,
    ports: [
      {
        port: parsed.port,
        ...(parsedTargetPort != null && { targetPort: parsedTargetPort }),
        ...(parsedTargetPort == null &&
          defaultTargetPort != null && { targetPort: defaultTargetPort }),
        ...(parsedNodePort != null && { nodePort: parsedNodePort })
      }
    ]
  })

  return createResourceWithEvents(service, clusterState, eventBus)
}
