import type { Gateway } from '../../../cluster/ressources/Gateway'
import type { GatewayClass } from '../../../cluster/ressources/GatewayClass'
import type { HTTPRoute } from '../../../cluster/ressources/HTTPRoute'
import type { IngressClass } from '../../../cluster/ressources/IngressClass'

const formatEventTimestampForDescribe = (timestamp: string): string => {
  if (timestamp.includes('.')) {
    return timestamp.replace(/\.\d{3}Z$/, 'Z')
  }
  return timestamp
}

export const describeCoreEvent = (
  eventItem: {
    metadata: {
      name: string
      namespace: string
      labels?: Record<string, string>
      creationTimestamp: string
      resourceVersion?: string
      uid?: string
    }
    involvedObject: {
      apiVersion: string
      kind: string
      name: string
      namespace?: string
    }
    reason: string
    message: string
    type: string
    count: number
    firstTimestamp: string
    lastTimestamp: string
  }
): string => {
  const involvedNamespace =
    eventItem.involvedObject.namespace ?? eventItem.metadata.namespace
  const labels = eventItem.metadata.labels
  const labelsText =
    labels == null || Object.keys(labels).length === 0
      ? '<none>'
      : Object.entries(labels)
          .map(([key, value]) => `${key}=${value}`)
          .join(',')
  const resourceVersion = eventItem.metadata.resourceVersion ?? '<unknown>'
  const uid = eventItem.metadata.uid ?? '<unknown>'
  const firstTimestamp = formatEventTimestampForDescribe(eventItem.firstTimestamp)
  const lastTimestamp = formatEventTimestampForDescribe(eventItem.lastTimestamp)
  const creationTimestamp = formatEventTimestampForDescribe(
    eventItem.metadata.creationTimestamp
  )
  return [
    `Name:             ${eventItem.metadata.name}`,
    `Namespace:        ${eventItem.metadata.namespace}`,
    `Labels:           ${labelsText}`,
    'Annotations:      <none>',
    'API Version:      v1',
    `Count:            ${eventItem.count}`,
    'Event Time:       <nil>',
    `First Timestamp:  ${firstTimestamp}`,
    'Involved Object:',
    `  API Version:   ${eventItem.involvedObject.apiVersion}`,
    `  Kind:          ${eventItem.involvedObject.kind}`,
    `  Name:          ${eventItem.involvedObject.name}`,
    `  Namespace:     ${involvedNamespace}`,
    'Kind:            Event',
    `Last Timestamp:  ${lastTimestamp}`,
    `Message:         ${eventItem.message}`,
    'Metadata:',
    `  Creation Timestamp:  ${creationTimestamp}`,
    `  Resource Version:    ${resourceVersion}`,
    `  UID:                 ${uid}`,
    `Reason:                ${eventItem.reason}`,
    'Reporting Component:   ',
    'Reporting Instance:    ',
    'Source:',
    `Type:    ${eventItem.type}`,
    'Events:  <none>'
  ].join('\n')
}

export const describeIngressClass = (resource: IngressClass): string => {
  return [
    `Name:         ${resource.metadata.name}`,
    'Labels:       <none>',
    'Annotations:  <none>',
    `Controller:   ${resource.spec.controller}`,
    'Events:       <none>'
  ].join('\n')
}

export const describeGatewayClass = (resource: GatewayClass): string => {
  const accepted =
    resource.status?.conditions?.find((condition) => {
      return condition.type === 'Accepted'
    })?.status ?? 'Unknown'
  return [
    `Name:         ${resource.metadata.name}`,
    'Namespace:    ',
    `API Version:  ${resource.apiVersion}`,
    `Kind:         ${resource.kind}`,
    `Controller:   ${resource.spec.controllerName}`,
    `Accepted:     ${accepted}`,
    'Events:       <none>'
  ].join('\n')
}

export const describeGateway = (resource: Gateway): string => {
  const addresses = (resource.status?.addresses ?? [])
    .map((address) => address.value)
    .join(', ')
  const programmed =
    resource.status?.conditions?.some((condition) => {
      return condition.type === 'Programmed' && condition.status === 'True'
    }) ?? false
  return [
    `Name:         ${resource.metadata.name}`,
    `Namespace:    ${resource.metadata.namespace}`,
    `API Version:  ${resource.apiVersion}`,
    `Kind:         ${resource.kind}`,
    `Gateway Class: ${resource.spec.gatewayClassName}`,
    `Addresses:    ${addresses || '<none>'}`,
    `Programmed:   ${programmed ? 'True' : 'False'}`,
    'Events:       <none>'
  ].join('\n')
}

export const describeHTTPRoute = (resource: HTTPRoute): string => {
  const hostnames = (resource.spec.hostnames ?? []).join(', ')
  const parentRefs = (resource.spec.parentRefs ?? [])
    .map((ref) => {
      const ns = ref.namespace ?? resource.metadata.namespace
      return `${ns}/${ref.name}`
    })
    .join(', ')
  return [
    `Name:         ${resource.metadata.name}`,
    `Namespace:    ${resource.metadata.namespace}`,
    `API Version:  ${resource.apiVersion}`,
    `Kind:         ${resource.kind}`,
    `Hostnames:    ${hostnames || '<none>'}`,
    `Parent Refs:  ${parentRefs || '<none>'}`,
    'Events:       <none>'
  ].join('\n')
}
