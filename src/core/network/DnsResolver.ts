import type { Result } from '../shared/result'
import { error, success } from '../shared/result'
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
  resolveARecord: (query: string, defaultNamespace: string) => Result<DnsLookupResult>
}

export const createDnsResolver = (networkState: NetworkState): DnsResolver => {
  const resolveARecord = (
    query: string,
    defaultNamespace: string
  ): Result<DnsLookupResult> => {
    const normalizedQuery = normalizeQuery(query)
    if (normalizedQuery.length === 0) {
      return error('** server can not find : NXDOMAIN')
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
