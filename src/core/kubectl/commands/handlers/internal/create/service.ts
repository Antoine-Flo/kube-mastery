import type { ApiServerFacade } from '../../../../../api/ApiServerFacade'
import { createService } from '../../../../../cluster/ressources/Service'
import type { ExecutionResult } from '../../../../../shared/result'
import { error } from '../../../../../shared/result'
import { createResourceWithEvents } from '../../../resourceHelpers'
import type { ParsedCommand } from '../../../types'
import type {
  CreateServiceType,
  ImperativeCreateServiceConfig
} from './types'

const toApiServiceType = (
  serviceType: CreateServiceType
): 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName' => {
  if (serviceType === 'clusterip') {
    return 'ClusterIP'
  }
  if (serviceType === 'nodeport') {
    return 'NodePort'
  }
  if (serviceType === 'loadbalancer') {
    return 'LoadBalancer'
  }
  return 'ExternalName'
}

const parsePositivePortNumber = (
  rawValue: string,
  flagName: string
): number | ExecutionResult => {
  const parsed = Number.parseInt(rawValue, 10)
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    return error(`error: ${flagName} must be a valid port number`)
  }
  return parsed
}

const parseTcpFlag = (
  rawTcpFlag: string
): Array<{ port: number; targetPort?: number }> | ExecutionResult => {
  const entries = rawTcpFlag
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  if (entries.length === 0) {
    return error('error: create service requires flag --tcp')
  }

  const ports: Array<{ port: number; targetPort?: number }> = []
  for (const entry of entries) {
    const parts = entry.split(':')
    if (parts.length > 2) {
      return error('error: invalid --tcp format, expected port[:targetPort]')
    }
    const parsedPort = parsePositivePortNumber(parts[0], '--tcp')
    if (typeof parsedPort !== 'number') {
      return parsedPort
    }

    if (parts.length === 1 || parts[1].trim().length === 0) {
      ports.push({ port: parsedPort, targetPort: parsedPort })
      continue
    }

    const parsedTargetPort = parsePositivePortNumber(parts[1], '--tcp')
    if (typeof parsedTargetPort !== 'number') {
      return parsedTargetPort
    }
    ports.push({ port: parsedPort, targetPort: parsedTargetPort })
  }

  return ports
}

const parseNodePortFlag = (
  rawNodePortFlag: string | boolean | undefined
): number | undefined | ExecutionResult => {
  if (rawNodePortFlag == null) {
    return undefined
  }
  if (typeof rawNodePortFlag !== 'string' || rawNodePortFlag.trim().length === 0) {
    return error('error: --node-port must be a valid port number')
  }
  const parsed = parsePositivePortNumber(rawNodePortFlag, '--node-port')
  if (typeof parsed !== 'number') {
    return parsed
  }
  return parsed
}

export const buildCreateServiceConfig = (
  parsed: ParsedCommand & { name: string; createServiceType: CreateServiceType }
): ImperativeCreateServiceConfig | ExecutionResult => {
  const namespace = parsed.namespace ?? 'default'
  const serviceType = parsed.createServiceType
  const apiServiceType = toApiServiceType(serviceType)
  const nodePortFlag = parseNodePortFlag(parsed.flags['node-port'])
  if (typeof nodePortFlag !== 'number' && nodePortFlag !== undefined) {
    return nodePortFlag
  }

  if (serviceType !== 'nodeport' && typeof nodePortFlag === 'number') {
    return error(`error: create service ${serviceType} does not support flag --node-port`)
  }

  const metadata = {
    name: parsed.name,
    labels: { app: parsed.name },
    ...(namespace !== 'default' ? { namespace } : {})
  }

  if (serviceType === 'externalname') {
    const externalName = parsed.flags['external-name']
    if (typeof externalName !== 'string' || externalName.trim().length === 0) {
      return error('error: create service externalname requires flag --external-name')
    }
    return {
      apiVersion: 'v1',
      kind: 'Service',
      metadata,
      spec: {
        type: apiServiceType,
        externalName,
        ports: []
      },
      status: {
        loadBalancer: {}
      }
    }
  }

  const tcpFlag = parsed.flags.tcp
  if (typeof tcpFlag !== 'string' || tcpFlag.trim().length === 0) {
    return error('error: create service requires flag --tcp')
  }
  const parsedPorts = parseTcpFlag(tcpFlag)
  if (!Array.isArray(parsedPorts)) {
    return parsedPorts
  }

  const ports = parsedPorts.map((port, index) => {
    const targetPort = port.targetPort ?? port.port
    const portName = `${port.port}-${targetPort}`
    if (index === 0 && typeof nodePortFlag === 'number') {
      return {
        name: portName,
        protocol: 'TCP' as const,
        port: port.port,
        ...(port.targetPort != null ? { targetPort: port.targetPort } : {}),
        nodePort: nodePortFlag
      }
    }
    return {
      name: portName,
      protocol: 'TCP' as const,
      port: port.port,
      ...(port.targetPort != null ? { targetPort: port.targetPort } : {})
    }
  })

  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata,
    spec: {
      type: apiServiceType,
      selector: { app: parsed.name },
      ports
    },
    status: {
      loadBalancer: {}
    }
  }
}

export const isCreateServiceImperative = (
  parsed: ParsedCommand
): parsed is ParsedCommand & { name: string; createServiceType: CreateServiceType } => {
  if (parsed.resource !== 'services') {
    return false
  }
  if (typeof parsed.createServiceType !== 'string') {
    return false
  }
  if (typeof parsed.name !== 'string') {
    return false
  }
  return parsed.name.length > 0
}

export const createServiceFromFlags = (
  parsed: ParsedCommand & { name: string; createServiceType: CreateServiceType },
  apiServer: ApiServerFacade
): ExecutionResult => {
  const serviceConfig = buildCreateServiceConfig(parsed)
  if (!('kind' in serviceConfig)) {
    return serviceConfig
  }

  const namespace = parsed.namespace ?? 'default'
  const service = createService({
    name: parsed.name,
    namespace,
    type: serviceConfig.spec.type,
    ...(serviceConfig.spec.selector != null
      ? { selector: serviceConfig.spec.selector }
      : {}),
    ...(serviceConfig.spec.externalName != null
      ? { externalName: serviceConfig.spec.externalName }
      : {}),
    ports: serviceConfig.spec.ports
  })

  return createResourceWithEvents(service, apiServer)
}
