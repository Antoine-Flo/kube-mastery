import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import {
  createService,
  type ServiceSpec
} from '../../../cluster/ressources/Service'
import type { ExecutionResult, Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import { toEqualitySelectorMap } from '../../../shared/labelSelector'
import type { ParsedCommand } from '../types'
import { createResourceWithEvents } from '../resourceHelpers'

type ExposeServiceType = NonNullable<ServiceSpec['type']>
type ExposeTargetResource = 'deployments' | 'pods'
const SUPPORTED_EXPOSE_RESOURCES: readonly ExposeTargetResource[] = [
  'deployments',
  'pods'
]

const parseExposeServiceType = (
  rawType: string | boolean | undefined
): ExecutionResult | ExposeServiceType => {
  if (rawType == null) {
    return 'ClusterIP'
  }
  if (typeof rawType !== 'string') {
    return error(
      'expose type must be one of: ClusterIP, NodePort, LoadBalancer'
    )
  }
  if (
    rawType !== 'ClusterIP' &&
    rawType !== 'NodePort' &&
    rawType !== 'LoadBalancer'
  ) {
    return error(
      'expose type must be one of: ClusterIP, NodePort, LoadBalancer'
    )
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
  apiServer: ApiServerFacade,
  deploymentName: string,
  namespace: string
): Result<Record<string, string>, string> => {
  const deploymentResult = apiServer.findResource(
    'Deployment',
    deploymentName,
    namespace
  )
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
  apiServer: ApiServerFacade,
  deploymentName: string,
  namespace: string
): number | undefined => {
  const deploymentResult = apiServer.findResource(
    'Deployment',
    deploymentName,
    namespace
  )
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

const resolveSelectorFromPod = (
  apiServer: ApiServerFacade,
  podName: string,
  namespace: string
): Result<Record<string, string>, string> => {
  const podResult = apiServer.findResource('Pod', podName, namespace)
  if (!podResult.ok) {
    return error(`Error from server (NotFound): pods "${podName}" not found`)
  }
  const labels = podResult.value.metadata.labels
  if (labels == null || Object.keys(labels).length === 0) {
    return error(`error: pod "${podName}" has no labels to expose`)
  }
  return success(labels)
}

const resolveDefaultTargetPortFromPod = (
  apiServer: ApiServerFacade,
  podName: string,
  namespace: string
): number | undefined => {
  const podResult = apiServer.findResource('Pod', podName, namespace)
  if (!podResult.ok) {
    return undefined
  }
  const firstContainer = podResult.value.spec.containers[0]
  const firstContainerPort = firstContainer?.ports?.[0]?.containerPort
  if (typeof firstContainerPort === 'number') {
    return firstContainerPort
  }
  return undefined
}

const resolveLabelsFromDeployment = (
  apiServer: ApiServerFacade,
  deploymentName: string,
  namespace: string
): Result<Record<string, string> | undefined, string> => {
  const deploymentResult = apiServer.findResource(
    'Deployment',
    deploymentName,
    namespace
  )
  if (!deploymentResult.ok) {
    return error(
      `Error from server (NotFound): deployments.apps "${deploymentName}" not found`
    )
  }
  return success(deploymentResult.value.metadata.labels)
}

const resolveLabelsFromPod = (
  apiServer: ApiServerFacade,
  podName: string,
  namespace: string
): Result<Record<string, string> | undefined, string> => {
  const podResult = apiServer.findResource('Pod', podName, namespace)
  if (!podResult.ok) {
    return error(`Error from server (NotFound): pods "${podName}" not found`)
  }
  return success(podResult.value.metadata.labels)
}

const parseExposeResource = (
  resource: ParsedCommand['resource']
): ExposeTargetResource | ExecutionResult => {
  if (resource == null) {
    return error('expose requires a resource type and name')
  }
  const isSupportedResource = SUPPORTED_EXPOSE_RESOURCES.includes(
    resource as ExposeTargetResource
  )
  if (!isSupportedResource) {
    return error('expose currently supports only deployment and pod resources')
  }
  return resource as ExposeTargetResource
}

const resolveSelectorFromResource = (
  apiServer: ApiServerFacade,
  resource: ExposeTargetResource,
  resourceName: string,
  namespace: string
): Result<Record<string, string>, string> => {
  if (resource === 'deployments') {
    return resolveSelectorFromDeployment(apiServer, resourceName, namespace)
  }
  return resolveSelectorFromPod(apiServer, resourceName, namespace)
}

const resolveDefaultTargetPortFromResource = (
  apiServer: ApiServerFacade,
  resource: ExposeTargetResource,
  resourceName: string,
  namespace: string
): number | undefined => {
  if (resource === 'deployments') {
    return resolveDefaultTargetPortFromDeployment(apiServer, resourceName, namespace)
  }
  return resolveDefaultTargetPortFromPod(apiServer, resourceName, namespace)
}

const resolveLabelsFromResource = (
  apiServer: ApiServerFacade,
  resource: ExposeTargetResource,
  resourceName: string,
  namespace: string
): Result<Record<string, string> | undefined, string> => {
  if (resource === 'deployments') {
    return resolveLabelsFromDeployment(apiServer, resourceName, namespace)
  }
  return resolveLabelsFromPod(apiServer, resourceName, namespace)
}

export const handleExpose = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ExecutionResult => {
  if (!parsed.resource || !parsed.name) {
    return error('expose requires a resource type and name')
  }
  const exposeResource = parseExposeResource(parsed.resource)
  if (typeof exposeResource !== 'string') {
    return exposeResource
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

  const sourceLabelsResult = resolveLabelsFromResource(
    apiServer,
    exposeResource,
    parsed.name,
    namespace
  )
  if (!sourceLabelsResult.ok) {
    return sourceLabelsResult
  }

  let selector: Record<string, string>
  if (parsed.selector != null) {
    const selectorMapResult = toEqualitySelectorMap(parsed.selector)
    if (!selectorMapResult.ok) {
      return selectorMapResult
    }
    selector = selectorMapResult.value
  } else {
    const selectorResult = resolveSelectorFromResource(
      apiServer,
      exposeResource,
      parsed.name,
      namespace
    )
    if (!selectorResult.ok) {
      return selectorResult
    }
    selector = selectorResult.value
  }

  const defaultTargetPort = resolveDefaultTargetPortFromResource(
    apiServer,
    exposeResource,
    parsed.name,
    namespace
  )
  const service = createService({
    name: serviceName,
    namespace,
    labels: sourceLabelsResult.value,
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

  return createResourceWithEvents(service, apiServer)
}
