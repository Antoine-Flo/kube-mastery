import type { ClusterStateData } from '../../../cluster/ClusterState'
import type { EndpointSlice } from '../../../cluster/ressources/EndpointSlice'
import type { Endpoints } from '../../../cluster/ressources/Endpoints'
import type { Service } from '../../../cluster/ressources/Service'
import { formatLabels } from '../internal/helpers'

const renderServicePort = (service: Service, portIndex: number): string => {
  const port = service.spec.ports[portIndex]
  if (port == null) {
    return '<none>'
  }
  const portName = port.name ?? '<unset>'
  return `${portName}  ${port.port}/${port.protocol}`
}

const renderServiceTargetPort = (
  service: Service,
  portIndex: number
): string => {
  const port = service.spec.ports[portIndex]
  if (port == null) {
    return '<none>'
  }
  const targetPort = port.targetPort ?? port.port
  return `${String(targetPort)}/${port.protocol}`
}

const renderServiceEndpoints = (
  service: Service,
  state: ClusterStateData
): string => {
  const renderKubernetesServiceFallback = (): string | undefined => {
    if (
      service.metadata.name !== 'kubernetes' ||
      service.metadata.namespace !== 'default'
    ) {
      return undefined
    }
    const controlPlaneNode = state.nodes.items.find((node) => {
      return (
        node.metadata.labels?.['node-role.kubernetes.io/control-plane'] != null
      )
    })
    const controlPlaneIp = controlPlaneNode?.status.addresses?.find(
      (address) => {
        return address.type === 'InternalIP'
      }
    )?.address
    if (controlPlaneIp == null) {
      return undefined
    }
    return `${controlPlaneIp}:6443`
  }
  const endpointsResource = state.endpoints.items.find((endpoints) => {
    return (
      endpoints.metadata.name === service.metadata.name &&
      endpoints.metadata.namespace === service.metadata.namespace
    )
  })
  if (endpointsResource == null) {
    const fallback = renderKubernetesServiceFallback()
    if (fallback != null) {
      return fallback
    }
    return '<none>'
  }
  const renderedEndpoints = renderEndpointsInline(endpointsResource)
  if (renderedEndpoints !== '<none>') {
    return renderedEndpoints
  }
  const fallback = renderKubernetesServiceFallback()
  if (fallback != null) {
    return fallback
  }
  return renderedEndpoints
}

const renderServiceDescribeEndpoints = (
  service: Service,
  state: ClusterStateData
): string => {
  const rendered = renderServiceEndpoints(service, state)
  if (rendered === '<none>') {
    return ''
  }
  return rendered
}

const renderEndpointsInline = (endpoints: Endpoints): string => {
  const subsets = endpoints.subsets ?? []
  const values: string[] = []
  for (const subset of subsets) {
    const addresses = subset.addresses ?? []
    const ports = subset.ports ?? []
    for (const address of addresses) {
      if (ports.length === 0) {
        values.push(address.ip)
        continue
      }
      for (const port of ports) {
        values.push(`${address.ip}:${port.port}`)
      }
    }
  }
  if (values.length === 0) {
    return '<none>'
  }
  return values.join(',')
}

export const describeEndpoints = (endpoints: Endpoints): string => {
  const lines: string[] = []
  lines.push(`Name:         ${endpoints.metadata.name}`)
  lines.push(`Namespace:    ${endpoints.metadata.namespace}`)
  lines.push(`Labels:       ${formatLabels(endpoints.metadata.labels)}`)
  lines.push(`Annotations:  ${formatLabels(endpoints.metadata.annotations)}`)
  lines.push(`Subsets:      ${renderEndpointsInline(endpoints)}`)
  lines.push('Events:       <none>')
  return lines.join('\n')
}

const renderEndpointSliceEndpointAddresses = (
  endpointSlice: EndpointSlice
): string => {
  const values = endpointSlice.endpoints.flatMap(
    (endpoint) => endpoint.addresses
  )
  if (values.length === 0) {
    return '<none>'
  }
  return values.join(',')
}

const renderEndpointSlicePorts = (endpointSlice: EndpointSlice): string => {
  const ports = endpointSlice.ports ?? []
  if (ports.length === 0) {
    return '<none>'
  }
  const rendered = ports.map((port) => {
    const protocol = port.protocol ?? 'TCP'
    const portNumber = port.port != null ? String(port.port) : '<unset>'
    return `${portNumber}/${protocol}`
  })
  return rendered.join(',')
}

export const describeEndpointSlice = (endpointSlice: EndpointSlice): string => {
  const lines: string[] = []
  lines.push(`Name:         ${endpointSlice.metadata.name}`)
  lines.push(`Namespace:    ${endpointSlice.metadata.namespace}`)
  lines.push(`Labels:       ${formatLabels(endpointSlice.metadata.labels)}`)
  lines.push(
    `Annotations:  ${formatLabels(endpointSlice.metadata.annotations)}`
  )
  lines.push(`AddressType:  ${endpointSlice.addressType}`)
  lines.push(`Ports:        ${renderEndpointSlicePorts(endpointSlice)}`)
  lines.push(
    `Endpoints:    ${renderEndpointSliceEndpointAddresses(endpointSlice)}`
  )
  lines.push('Events:       <none>')
  return lines.join('\n')
}

export const describeService = (
  service: Service,
  state: ClusterStateData
): string => {
  const lines: string[] = []
  lines.push(`Name:                     ${service.metadata.name}`)
  lines.push(`Namespace:                ${service.metadata.namespace}`)
  lines.push(
    `Labels:                   ${formatLabels(service.metadata.labels)}`
  )
  lines.push(
    `Annotations:              ${formatLabels(service.metadata.annotations)}`
  )
  lines.push(`Selector:                 ${formatLabels(service.spec.selector)}`)
  lines.push(`Type:                     ${service.spec.type ?? 'ClusterIP'}`)
  lines.push('IP Family Policy:         SingleStack')
  lines.push('IP Families:              IPv4')
  lines.push(`IP:                       ${service.spec.clusterIP ?? '<none>'}`)
  lines.push(`IPs:                      ${service.spec.clusterIP ?? '<none>'}`)
  lines.push(`Port:                     ${renderServicePort(service, 0)}`)
  lines.push(`TargetPort:               ${renderServiceTargetPort(service, 0)}`)
  lines.push(
    `Endpoints:                ${renderServiceDescribeEndpoints(service, state)}`
  )
  lines.push(
    `Session Affinity:         ${service.spec.sessionAffinity ?? 'None'}`
  )
  lines.push('Internal Traffic Policy:  Cluster')
  lines.push('Events:                   <none>')
  return lines.join('\n')
}
