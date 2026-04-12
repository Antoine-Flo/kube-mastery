import { deepFreeze } from '../../shared/deepFreeze'
import type { components } from '../../openapi/generated/openapi-types.generated'
import type {
  K8sEndpointSlice,
  K8sEndpointSliceMetadata
} from '../../openapi/generated/k8sOpenapiAliases.generated'
import type { ServiceEndpointBackend } from './Endpoints'
import type { NamespacedFactoryConfigBase } from './resourceFactoryConfig'

type IoSchemas = components['schemas']

type EndpointSliceMetadata = Pick<
  K8sEndpointSliceMetadata,
  'name' | 'namespace' | 'labels' | 'annotations' | 'creationTimestamp'
>

export type EndpointSlicePort =
  IoSchemas['io.k8s.api.discovery.v1.EndpointPort'] & {
    protocol?: 'TCP' | 'UDP' | 'SCTP'
  }

export type EndpointSliceEndpoint =
  IoSchemas['io.k8s.api.discovery.v1.Endpoint']

export type EndpointSlice = Omit<
  K8sEndpointSlice,
  'metadata' | 'addressType' | 'ports' | 'endpoints'
> & {
  metadata: EndpointSliceMetadata
  addressType: 'IPv4' | 'IPv6' | 'FQDN'
  ports?: EndpointSlicePort[]
  endpoints: EndpointSliceEndpoint[]
}

interface EndpointSliceConfig extends NamespacedFactoryConfigBase {
  addressType?: 'IPv4' | 'IPv6' | 'FQDN'
  ports?: EndpointSlicePort[]
  endpoints: EndpointSliceEndpoint[]
}

const ENDPOINT_SLICE_SUFFIX_LENGTH = 5

const generateEndpointSliceSuffix = (): string => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let value = ''
  for (let index = 0; index < ENDPOINT_SLICE_SUFFIX_LENGTH; index++) {
    const randomIndex = Math.floor(Math.random() * alphabet.length)
    value = `${value}${alphabet[randomIndex]}`
  }
  return value
}

export const generateServiceEndpointSliceName = (
  serviceName: string
): string => {
  return `${serviceName}-${generateEndpointSliceSuffix()}`
}

const normalizePortsFromBackends = (
  backends: ServiceEndpointBackend[]
): EndpointSlicePort[] => {
  const uniquePorts = [
    ...new Set(backends.map((backend) => backend.targetPort))
  ]
  return uniquePorts
    .sort((left, right) => {
      return left - right
    })
    .map((targetPort) => {
      return {
        port: targetPort,
        protocol: 'TCP'
      }
    })
}

const normalizeEndpointsFromBackends = (
  backends: ServiceEndpointBackend[]
): EndpointSliceEndpoint[] => {
  const endpointByKey = new Map<string, EndpointSliceEndpoint>()
  for (const backend of backends) {
    const key = `${backend.podIP}/${backend.namespace}/${backend.podName}`
    if (endpointByKey.has(key)) {
      continue
    }
    endpointByKey.set(key, {
      addresses: [backend.podIP],
      conditions: {
        ready: true,
        serving: true,
        terminating: false
      },
      ...(backend.nodeName != null && { nodeName: backend.nodeName }),
      targetRef: {
        kind: 'Pod',
        name: backend.podName,
        namespace: backend.namespace
      }
    })
  }
  return [...endpointByKey.values()].sort((left, right) => {
    const leftAddress = left.addresses[0] ?? ''
    const rightAddress = right.addresses[0] ?? ''
    if (leftAddress !== rightAddress) {
      return leftAddress.localeCompare(rightAddress)
    }
    const leftName = left.targetRef?.name ?? ''
    const rightName = right.targetRef?.name ?? ''
    return leftName.localeCompare(rightName)
  })
}

export const createEndpointSlice = (
  config: EndpointSliceConfig
): EndpointSlice => {
  const endpointSlice: EndpointSlice = {
    apiVersion: 'discovery.k8s.io/v1',
    kind: 'EndpointSlice',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp: config.creationTimestamp ?? new Date().toISOString(),
      ...(config.labels != null && { labels: config.labels }),
      ...(config.annotations != null && { annotations: config.annotations })
    },
    addressType: config.addressType ?? 'IPv4',
    ...(config.ports != null &&
      config.ports.length > 0 && { ports: config.ports }),
    endpoints: config.endpoints
  }
  return deepFreeze(endpointSlice)
}

export const createServiceEndpointSlice = (config: {
  serviceName: string
  namespace: string
  backends: ServiceEndpointBackend[]
  name?: string
  creationTimestamp?: string
}): EndpointSlice => {
  const ports = normalizePortsFromBackends(config.backends)
  const endpoints = normalizeEndpointsFromBackends(config.backends)
  return createEndpointSlice({
    name: config.name ?? generateServiceEndpointSliceName(config.serviceName),
    namespace: config.namespace,
    ports,
    endpoints,
    labels: {
      'kubernetes.io/service-name': config.serviceName
    },
    creationTimestamp: config.creationTimestamp
  })
}
