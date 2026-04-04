import type { Result } from '../shared/result'
import { error, success } from '../shared/result'
import type { ApiServerFacade } from '../api/ApiServerFacade'
import type { NetworkState, SimServiceRuntime } from './NetworkState'

export interface DnsLookupResult {
  query: string
  fqdn: string
  addresses: string[]
}

const normalizeQuery = (query: string): string => {
  return query.trim().replace(/\.$/, '').toLowerCase()
}

const buildCandidateServiceLookups = (
  normalizedQuery: string,
  defaultNamespace: string
): Array<{ namespace: string; serviceName: string; fqdn: string }> => {
  const segments = normalizedQuery.split('.')
  if (segments.length === 1) {
    return [
      {
        namespace: defaultNamespace,
        serviceName: segments[0],
        fqdn: `${segments[0]}.${defaultNamespace}.svc.cluster.local`
      }
    ]
  }
  if (segments.length === 2) {
    return [
      {
        namespace: segments[1],
        serviceName: segments[0],
        fqdn: `${segments[0]}.${segments[1]}.svc.cluster.local`
      }
    ]
  }
  if (segments.length === 3 && segments[2] === 'svc') {
    return [
      {
        namespace: segments[1],
        serviceName: segments[0],
        fqdn: `${segments[0]}.${segments[1]}.svc.cluster.local`
      }
    ]
  }
  if (
    segments.length === 5 &&
    segments[2] === 'svc' &&
    segments[3] === 'cluster' &&
    segments[4] === 'local'
  ) {
    return [
      {
        namespace: segments[1],
        serviceName: segments[0],
        fqdn: normalizedQuery
      }
    ]
  }
  return []
}

const getServiceAddresses = (serviceRuntime: SimServiceRuntime): string[] => {
  if (serviceRuntime.serviceType === 'ExternalName') {
    return []
  }
  if (serviceRuntime.clusterIP == null || serviceRuntime.clusterIP === 'None') {
    return []
  }
  return [serviceRuntime.clusterIP]
}

export interface DnsResolver {
  resolveARecord: (
    query: string,
    defaultNamespace: string
  ) => Result<DnsLookupResult>
}

const parsePodIpDnsQuery = (
  normalizedQuery: string
): { namespace: string; ipAddress: string } | undefined => {
  const podIpQueryMatch = normalizedQuery.match(
    /^(\d+)-(\d+)-(\d+)-(\d+)\.([a-z0-9-]+)\.pod\.cluster\.local$/
  )
  if (podIpQueryMatch == null) {
    return undefined
  }
  return {
    ipAddress: `${podIpQueryMatch[1]}.${podIpQueryMatch[2]}.${podIpQueryMatch[3]}.${podIpQueryMatch[4]}`,
    namespace: podIpQueryMatch[5]
  }
}

const parseHeadlessPodDnsQuery = (
  normalizedQuery: string
):
  | {
      podName: string
      serviceName: string
      namespace: string
      fqdn: string
    }
  | undefined => {
  const segments = normalizedQuery.split('.')
  const hasExpectedSegments =
    segments.length === 6 &&
    segments[3] === 'svc' &&
    segments[4] === 'cluster' &&
    segments[5] === 'local'
  if (!hasExpectedSegments) {
    return undefined
  }
  return {
    podName: segments[0],
    serviceName: segments[1],
    namespace: segments[2],
    fqdn: normalizedQuery
  }
}

const hasAllSelectorLabels = (
  labels: Record<string, string> | undefined,
  selector: Record<string, string> | undefined
): boolean => {
  if (selector == null || Object.keys(selector).length === 0) {
    return false
  }
  if (labels == null) {
    return false
  }
  for (const [key, value] of Object.entries(selector)) {
    if (labels[key] !== value) {
      return false
    }
  }
  return true
}

const resolvePodIpARecord = (
  query: string,
  normalizedQuery: string,
  apiServer?: ApiServerFacade
): Result<DnsLookupResult> | undefined => {
  if (apiServer == null) {
    return undefined
  }
  const podIpQuery = parsePodIpDnsQuery(normalizedQuery)
  if (podIpQuery == null) {
    return undefined
  }
  const pods = apiServer.listResources('Pod', podIpQuery.namespace)
  const matchingPod = pods.find((pod) => {
    return pod.status.podIP === podIpQuery.ipAddress
  })
  if (matchingPod == null) {
    return undefined
  }
  return success({
    query,
    fqdn: normalizedQuery,
    addresses: [podIpQuery.ipAddress]
  })
}

const resolveHeadlessPodARecord = (
  query: string,
  normalizedQuery: string,
  apiServer?: ApiServerFacade
): Result<DnsLookupResult> | undefined => {
  if (apiServer == null) {
    return undefined
  }
  const parsedHeadlessPodQuery = parseHeadlessPodDnsQuery(normalizedQuery)
  if (parsedHeadlessPodQuery == null) {
    return undefined
  }
  const serviceResult = apiServer.findResource(
    'Service',
    parsedHeadlessPodQuery.serviceName,
    parsedHeadlessPodQuery.namespace
  )
  if (!serviceResult.ok) {
    return undefined
  }
  if (serviceResult.value.spec.clusterIP !== 'None') {
    return undefined
  }
  const podResult = apiServer.findResource(
    'Pod',
    parsedHeadlessPodQuery.podName,
    parsedHeadlessPodQuery.namespace
  )
  if (!podResult.ok) {
    return undefined
  }
  if (
    !hasAllSelectorLabels(
      podResult.value.metadata.labels,
      serviceResult.value.spec.selector
    )
  ) {
    return undefined
  }
  const podIpAddress = podResult.value.status.podIP
  if (podIpAddress == null || podIpAddress.length === 0) {
    return undefined
  }
  return success({
    query,
    fqdn: parsedHeadlessPodQuery.fqdn,
    addresses: [podIpAddress]
  })
}

export const createDnsResolver = (
  networkState: NetworkState,
  apiServer?: ApiServerFacade
): DnsResolver => {
  const resolveARecord = (
    query: string,
    defaultNamespace: string
  ): Result<DnsLookupResult> => {
    const normalizedQuery = normalizeQuery(query)
    if (normalizedQuery.length === 0) {
      return error('** server can not find : NXDOMAIN')
    }

    const podIpResolution = resolvePodIpARecord(
      query,
      normalizedQuery,
      apiServer
    )
    if (podIpResolution != null) {
      return podIpResolution
    }
    const headlessPodResolution = resolveHeadlessPodARecord(
      query,
      normalizedQuery,
      apiServer
    )
    if (headlessPodResolution != null) {
      return headlessPodResolution
    }

    const candidates = buildCandidateServiceLookups(
      normalizedQuery,
      defaultNamespace
    )
    for (const candidate of candidates) {
      const serviceRuntime = networkState.getServiceRuntime(
        candidate.namespace,
        candidate.serviceName
      )
      if (serviceRuntime == null) {
        continue
      }
      const addresses = getServiceAddresses(serviceRuntime)
      if (addresses.length === 0) {
        return error(`** server can not find ${query}: NXDOMAIN`)
      }
      return success({
        query,
        fqdn: candidate.fqdn,
        addresses
      })
    }

    return error(`** server can not find ${query}: NXDOMAIN`)
  }

  return {
    resolveARecord
  }
}
