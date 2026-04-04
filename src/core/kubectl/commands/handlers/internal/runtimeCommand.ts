import type { SimNetworkRuntime } from '../../../../network/SimNetworkRuntime'
import type { ExecutionIO, ExecutionResult } from '../../../../shared/result'
import { error, success } from '../../../../shared/result'

const extractCurlTarget = (command: string[]): string | undefined => {
  let shouldTreatNextTokenAsTarget = false
  for (let index = 1; index < command.length; index += 1) {
    const token = command[index]
    if (shouldTreatNextTokenAsTarget) {
      return token
    }
    if (token === '--') {
      shouldTreatNextTokenAsTarget = true
      continue
    }
    if (token.startsWith('-')) {
      continue
    }
    return token
  }
  return undefined
}

export interface RuntimeCommandResult {
  stdout: string
  stderr: string
  exitCode: number
}

const successResult = (stdout: string): RuntimeCommandResult => {
  return {
    stdout,
    stderr: '',
    exitCode: 0
  }
}

const errorResult = (stderr: string, stdout = ''): RuntimeCommandResult => {
  return {
    stdout,
    stderr,
    exitCode: 1
  }
}

const toExecutionIo = (result: RuntimeCommandResult): ExecutionIO => {
  return {
    stdout: result.stdout,
    stderr: result.stderr,
    exitCode: result.exitCode
  }
}

const buildResolvConfContent = (namespace: string): string => {
  return [
    `search ${namespace}.svc.cluster.local svc.cluster.local cluster.local`,
    'nameserver 10.96.0.10',
    'options ndots:5'
  ].join('\n')
}

const handleCatCommand = (
  command: string[],
  namespace: string
): RuntimeCommandResult | undefined => {
  const isResolvConfLookup =
    command.length === 2 &&
    command[0] === 'cat' &&
    command[1] === '/etc/resolv.conf'
  if (!isResolvConfLookup) {
    return undefined
  }
  return successResult(buildResolvConfContent(namespace))
}

const buildDigAnswer = (query: string, ipAddress: string): string => {
  return [
    `; <<>> DiG 9.9.5-9+deb8u19-Debian <<>> ${query}`,
    ';; global options: +cmd',
    ';; Got answer:',
    ';; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: 44933',
    ';; flags: qr aa rd; QUERY: 1, ANSWER: 1, AUTHORITY: 0, ADDITIONAL: 1',
    ';; WARNING: recursion requested but not available',
    '',
    ';; OPT PSEUDOSECTION:',
    '; EDNS: version: 0, flags:; udp: 4096',
    ';; QUESTION SECTION:',
    `;${query}. IN\tA`,
    '',
    ';; ANSWER SECTION:',
    `${query}. 30 IN A\t${ipAddress}`,
    '',
    ';; Query time: 0 msec',
    ';; SERVER: 10.96.0.10#53(10.96.0.10)',
    `;; WHEN: ${new Date().toUTCString()}`,
    ';; MSG SIZE  rcvd: 111'
  ].join('\n')
}

const handleDigCommand = (
  command: string[],
  namespace: string,
  networkRuntime?: SimNetworkRuntime
): RuntimeCommandResult | undefined => {
  const isDig = command[0] === 'dig'
  if (!isDig) {
    return undefined
  }
  const query = command[1]
  if (query == null || query.length === 0) {
    return errorResult('dig: missing query argument')
  }
  if (networkRuntime == null) {
    return errorResult('Error: network runtime is not available')
  }
  const dnsResult = networkRuntime.dnsResolver.resolveARecord(query, namespace)
  if (!dnsResult.ok) {
    return errorResult(dnsResult.error)
  }
  const address = dnsResult.value.addresses[0]
  return successResult(buildDigAnswer(query, address))
}

const findServiceClusterIp = (
  networkRuntime: SimNetworkRuntime,
  serviceName: string,
  namespace: string
): string | undefined => {
  const runtime = networkRuntime.state.getServiceRuntime(namespace, serviceName)
  if (runtime == null) {
    return undefined
  }
  if (runtime.clusterIP == null || runtime.clusterIP === 'None') {
    return undefined
  }
  return runtime.clusterIP
}

const buildNslookupHeader = (): string[] => {
  return ['Server:\t\t10.96.0.10', 'Address:\t10.96.0.10:53', '']
}

const buildNxDomainLine = (name: string): string => {
  return `** server can't find ${name}: NXDOMAIN`
}

const buildSuccessLookupLines = (
  resolvedName: string,
  ipAddress: string
): string[] => {
  return [`Name:\t${resolvedName}`, `Address: ${ipAddress}`]
}

const handleSingleLabelNslookup = (
  query: string,
  namespace: string,
  networkRuntime: SimNetworkRuntime
): RuntimeCommandResult => {
  const outputLines = buildNslookupHeader()
  const clusterLocalQuery = `${query}.cluster.local`
  const svcClusterLocalQuery = `${query}.svc.cluster.local`
  outputLines.push(buildNxDomainLine(clusterLocalQuery))
  outputLines.push('')
  outputLines.push(buildNxDomainLine(svcClusterLocalQuery))
  outputLines.push('')

  const resolvedIp = findServiceClusterIp(networkRuntime, query, namespace)
  if (resolvedIp != null) {
    outputLines.push('')
    outputLines.push(
      ...buildSuccessLookupLines(
        `${query}.${namespace}.svc.cluster.local`,
        resolvedIp
      )
    )
    outputLines.push('')
    outputLines.push(buildNxDomainLine(svcClusterLocalQuery))
    outputLines.push('')
    outputLines.push(buildNxDomainLine(clusterLocalQuery))
    return errorResult('pod terminated (Error)', outputLines.join('\n'))
  }

  const namespaceScopedQuery = `${query}.${namespace}.svc.cluster.local`
  outputLines.push(buildNxDomainLine(namespaceScopedQuery))
  outputLines.push('')
  outputLines.push(buildNxDomainLine(namespaceScopedQuery))
  outputLines.push('')
  outputLines.push(buildNxDomainLine(svcClusterLocalQuery))
  outputLines.push('')
  outputLines.push(buildNxDomainLine(clusterLocalQuery))
  return errorResult('pod terminated (Error)', outputLines.join('\n'))
}

const handleNslookupCommand = (
  command: string[],
  namespace: string,
  networkRuntime?: SimNetworkRuntime
): RuntimeCommandResult => {
  const lookupQuery = command[1]
  if (lookupQuery == null) {
    return errorResult('** server can not find : NXDOMAIN')
  }
  if (networkRuntime == null) {
    return errorResult('Error: network runtime is not available')
  }

  const normalizedQuery = lookupQuery.trim().replace(/\.$/, '').toLowerCase()
  const segmentCount = normalizedQuery.split('.').length
  if (segmentCount === 1) {
    return handleSingleLabelNslookup(normalizedQuery, namespace, networkRuntime)
  }
  if (segmentCount === 2) {
    const output = [...buildNslookupHeader()]
    output.push(buildNxDomainLine(normalizedQuery))
    output.push('')
    output.push(buildNxDomainLine(normalizedQuery))
    return errorResult('pod terminated (Error)', output.join('\n'))
  }

  const dnsResult = networkRuntime.dnsResolver.resolveARecord(
    normalizedQuery,
    namespace
  )
  if (!dnsResult.ok) {
    return errorResult(`** server can't find ${normalizedQuery}: NXDOMAIN`)
  }
  const resolvedIp = dnsResult.value.addresses[0]
  return successResult(
    [
      ...buildNslookupHeader(),
      ...buildSuccessLookupLines(dnsResult.value.fqdn, resolvedIp)
    ].join('\n')
  )
}

export const executeRuntimeAttachedCommand = (
  command: string[],
  namespace: string,
  networkRuntime?: SimNetworkRuntime
): RuntimeCommandResult | undefined => {
  const commandHead = command[0]
  const catResult = handleCatCommand(command, namespace)
  if (catResult != null) {
    return catResult
  }
  const digResult = handleDigCommand(command, namespace, networkRuntime)
  if (digResult != null) {
    return digResult
  }
  if (commandHead === 'nslookup') {
    return handleNslookupCommand(command, namespace, networkRuntime)
  }
  if (commandHead !== 'curl') {
    return undefined
  }

  if (networkRuntime == null) {
    return errorResult('Error: network runtime is not available')
  }
  const curlTarget = extractCurlTarget(command)
  if (curlTarget == null) {
    return errorResult('curl: try "curl <url>"')
  }
  const curlResult = networkRuntime.trafficEngine.simulateHttpGet(curlTarget, {
    sourceNamespace: namespace
  })
  if (!curlResult.ok) {
    return errorResult(curlResult.error)
  }
  return successResult(curlResult.value)
}

export const executeRuntimeNetworkCommand = (
  command: string[],
  namespace: string,
  networkRuntime?: SimNetworkRuntime
): ExecutionResult | undefined => {
  const runtimeResult = executeRuntimeAttachedCommand(
    command,
    namespace,
    networkRuntime
  )
  if (runtimeResult == null) {
    return undefined
  }
  if (runtimeResult.exitCode === 0) {
    return {
      ...success(runtimeResult.stdout),
      io: toExecutionIo(runtimeResult)
    }
  }
  const message =
    runtimeResult.stderr.length > 0
      ? runtimeResult.stderr
      : runtimeResult.stdout
  return {
    ...error(message),
    io: toExecutionIo(runtimeResult)
  }
}
