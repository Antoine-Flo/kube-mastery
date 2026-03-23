import type { SimNetworkRuntime } from '../../../../network/SimNetworkRuntime'
import type { ExecutionResult } from '../../../../shared/result'
import { error } from '../../../../shared/result'

export const executeRuntimeNetworkCommand = (
  command: string[],
  namespace: string,
  networkRuntime?: SimNetworkRuntime
): ExecutionResult | undefined => {
  const commandHead = command[0]
  if (commandHead !== 'nslookup' && commandHead !== 'curl') {
    return undefined
  }

  if (networkRuntime == null) {
    return error('Error: network runtime is not available')
  }

  if (commandHead === 'nslookup') {
    const lookupQuery = command[1]
    if (lookupQuery == null) {
      return error('** server can not find : NXDOMAIN')
    }
    const dnsResult = networkRuntime.dnsResolver.resolveARecord(
      lookupQuery,
      namespace
    )
    if (!dnsResult.ok) {
      return error(dnsResult.error)
    }
    const address = dnsResult.value.addresses[0]
    return {
      ok: true,
      value: [
        'Server:\t10.96.0.10',
        'Address:\t10.96.0.10:53',
        '',
        `Name:\t${dnsResult.value.fqdn}`,
        `Address:\t${address}`
      ].join('\n')
    }
  }

  const curlTarget = command[1]
  if (curlTarget == null) {
    return error('curl: try "curl <url>"')
  }
  const curlResult = networkRuntime.trafficEngine.simulateHttpGet(curlTarget, {
    sourceNamespace: namespace
  })
  if (!curlResult.ok) {
    return error(curlResult.error)
  }
  return { ok: true, value: curlResult.value }
}
