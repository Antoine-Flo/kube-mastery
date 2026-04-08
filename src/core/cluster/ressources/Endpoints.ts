import { deepFreeze } from '../../shared/deepFreeze'
import type { components } from '../../openapi/generated/openapi-types.generated'
import type {
  K8sEndpoints,
  K8sEndpointsMetadata
} from '../../openapi/generated/k8sOpenapiAliases.generated'
import type { NamespacedFactoryConfigBase } from './resourceFactoryConfig'

type IoSchemas = components['schemas']

type EndpointsMetadata = Pick<
  K8sEndpointsMetadata,
  'name' | 'namespace' | 'labels' | 'annotations' | 'creationTimestamp'
>

export type EndpointsAddress =
  IoSchemas['io.k8s.api.core.v1.EndpointAddress']

export type EndpointsPort = IoSchemas['io.k8s.api.core.v1.EndpointPort'] & {
  protocol?: 'TCP' | 'UDP' | 'SCTP'
}

export type EndpointsSubset = IoSchemas['io.k8s.api.core.v1.EndpointSubset']

export type Endpoints = Omit<K8sEndpoints, 'metadata' | 'subsets'> & {
  metadata: EndpointsMetadata
  subsets?: EndpointsSubset[]
}

interface EndpointsConfig extends NamespacedFactoryConfigBase {
  subsets?: EndpointsSubset[]
}

export interface ServiceEndpointBackend {
  podName: string
  namespace: string
  podIP: string
  targetPort: number
  nodeName?: string
}

const normalizeSubsetAddresses = (
  backends: ServiceEndpointBackend[]
): EndpointsAddress[] => {
  const addressByKey = new Map<string, EndpointsAddress>()
  for (const backend of backends) {
    const key = `${backend.podIP}/${backend.namespace}/${backend.podName}`
    if (addressByKey.has(key)) {
      continue
    }
    addressByKey.set(key, {
      ip: backend.podIP,
      ...(backend.nodeName != null && { nodeName: backend.nodeName }),
      targetRef: {
        kind: 'Pod',
        name: backend.podName,
        namespace: backend.namespace
      }
    })
  }
  return [...addressByKey.values()].sort((left, right) => {
    if (left.ip !== right.ip) {
      return left.ip.localeCompare(right.ip)
    }
    const leftName = left.targetRef?.name ?? ''
    const rightName = right.targetRef?.name ?? ''
    return leftName.localeCompare(rightName)
  })
}

const normalizeSubsetsFromBackends = (
  backends: ServiceEndpointBackend[]
): EndpointsSubset[] => {
  const backendsByTargetPort = new Map<number, ServiceEndpointBackend[]>()
  for (const backend of backends) {
    const group = backendsByTargetPort.get(backend.targetPort)
    if (group == null) {
      backendsByTargetPort.set(backend.targetPort, [backend])
      continue
    }
    group.push(backend)
  }

  const targetPorts = [...backendsByTargetPort.keys()].sort((left, right) => {
    return left - right
  })
  const subsets: EndpointsSubset[] = []
  for (const targetPort of targetPorts) {
    const targetPortBackends = backendsByTargetPort.get(targetPort) ?? []
    subsets.push({
      addresses: normalizeSubsetAddresses(targetPortBackends),
      ports: [
        {
          port: targetPort,
          protocol: 'TCP'
        }
      ]
    })
  }
  return subsets
}

export const createEndpoints = (config: EndpointsConfig): Endpoints => {
  const endpoints: Endpoints = {
    apiVersion: 'v1',
    kind: 'Endpoints',
    metadata: {
      name: config.name,
      namespace: config.namespace,
      creationTimestamp: config.creationTimestamp ?? new Date().toISOString(),
      ...(config.labels != null && { labels: config.labels }),
      ...(config.annotations != null && { annotations: config.annotations })
    },
    ...(config.subsets != null && { subsets: config.subsets })
  }
  return deepFreeze(endpoints)
}

export const createServiceEndpoints = (config: {
  serviceName: string
  namespace: string
  backends: ServiceEndpointBackend[]
  creationTimestamp?: string
}): Endpoints => {
  const subsets = normalizeSubsetsFromBackends(config.backends)
  return createEndpoints({
    name: config.serviceName,
    namespace: config.namespace,
    subsets: subsets.length > 0 ? subsets : undefined,
    creationTimestamp: config.creationTimestamp
  })
}
