import type { Result } from '../shared/result'
import { error, success } from '../shared/result'
import type { DnsResolver } from './DnsResolver'
import type {
  NetworkState,
  SimServiceEndpoint,
  SimServiceRuntime
} from './NetworkState'

export interface SimHttpRequestContext {
  sourceNamespace: string
}

export interface TrafficEngine {
  simulateHttpGet: (
    target: string,
    context: SimHttpRequestContext
  ) => Result<string>
}

const NGINX_DEFAULT_HTML_BODY = `<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
<style>
html { color-scheme: light dark; }
body { width: 35em; margin: 0 auto;
font-family: Tahoma, Verdana, Arial, sans-serif; }
</style>
</head>
<body>
<h1>Welcome to nginx!</h1>
<p>If you see this page, nginx is successfully installed and working.
Further configuration is required for the web server, reverse proxy,
API gateway, load balancer, content cache, or other features.</p>

<p>For online documentation and support please refer to
<a href="https://nginx.org/">nginx.org</a>.<br/>
To engage with the community please visit
<a href="https://community.nginx.org/">community.nginx.org</a>.<br/>
For enterprise grade support, professional services, additional
security features and capabilities please refer to
<a href="https://f5.com/nginx">f5.com/nginx</a>.</p>

<p><em>Thank you for using nginx.</em></p>
</body>
</html>`

const GENERIC_HTTP_OK_BODY = 'ok'

const isIpv4 = (value: string): boolean => {
  const octets = value.split('.')
  if (octets.length !== 4) {
    return false
  }
  return octets.every((octet) => {
    const number = Number.parseInt(octet, 10)
    return !Number.isNaN(number) && number >= 0 && number <= 255
  })
}

const parseTargetUrl = (target: string): Result<URL> => {
  const normalized =
    target.startsWith('http://') || target.startsWith('https://')
      ? target
      : `http://${target}`
  try {
    return success(new URL(normalized))
  } catch {
    return error(`curl: (3) URL malformed: ${target}`)
  }
}

const pickEndpointRoundRobin = (
  endpoints: SimServiceEndpoint[],
  key: string,
  counters: Map<string, number>
): SimServiceEndpoint => {
  const current = counters.get(key) ?? 0
  const next = current % endpoints.length
  counters.set(key, current + 1)
  return endpoints[next]
}

const findServiceByServicePort = (
  serviceRuntime: SimServiceRuntime,
  port: number
): boolean => {
  return serviceRuntime.ports.some((servicePort) => servicePort.port === port)
}

const buildHttpBodyFromEndpoint = (endpoint: SimServiceEndpoint): string => {
  if (endpoint.responseProfile === 'nginx') {
    return NGINX_DEFAULT_HTML_BODY
  }
  return GENERIC_HTTP_OK_BODY
}

export const createTrafficEngine = (
  networkState: NetworkState,
  dnsResolver: DnsResolver
): TrafficEngine => {
  const counters = new Map<string, number>()

  const resolveRuntimeFromUrl = (
    parsedUrl: URL,
    sourceNamespace: string
  ): Result<{
    serviceRuntime: SimServiceRuntime
    routeType: 'cluster-ip' | 'node-port'
    port: number
  }> => {
    const port =
      parsedUrl.port.length > 0 ? Number.parseInt(parsedUrl.port, 10) : 80
    if (Number.isNaN(port) || port <= 0) {
      return error(`curl: (3) invalid port in URL: ${parsedUrl.href}`)
    }

    const hostname = parsedUrl.hostname.toLowerCase()
    if (isIpv4(hostname)) {
      const byClusterIp = networkState.findServiceByClusterIp(hostname)
      if (byClusterIp != null && findServiceByServicePort(byClusterIp, port)) {
        return success({
          serviceRuntime: byClusterIp,
          routeType: 'cluster-ip',
          port
        })
      }
      const byNodePort = networkState.findServiceByNodePort(port)
      if (byNodePort != null) {
        return success({
          serviceRuntime: byNodePort,
          routeType: 'node-port',
          port
        })
      }
      return error(`curl: (7) Failed to connect to ${hostname} port ${port}`)
    }

    const dnsResult = dnsResolver.resolveARecord(hostname, sourceNamespace)
    if (!dnsResult.ok) {
      return error(`curl: (6) Could not resolve host: ${hostname}`)
    }

    const serviceIp = dnsResult.value.addresses[0]
    const serviceRuntime = networkState.findServiceByClusterIp(serviceIp)
    if (
      serviceRuntime == null ||
      !findServiceByServicePort(serviceRuntime, port)
    ) {
      return error(`curl: (7) Failed to connect to ${hostname} port ${port}`)
    }

    return success({
      serviceRuntime,
      routeType: 'cluster-ip',
      port
    })
  }

  const simulateHttpGet = (
    target: string,
    context: SimHttpRequestContext
  ): Result<string> => {
    const parsedUrlResult = parseTargetUrl(target)
    if (!parsedUrlResult.ok) {
      return parsedUrlResult
    }

    const runtimeResult = resolveRuntimeFromUrl(
      parsedUrlResult.value,
      context.sourceNamespace
    )
    if (!runtimeResult.ok) {
      return runtimeResult
    }

    const serviceRuntime = runtimeResult.value.serviceRuntime
    if (serviceRuntime.endpoints.length === 0) {
      return error(
        `curl: (52) Empty reply from service ${serviceRuntime.serviceName}.${serviceRuntime.namespace}`
      )
    }

    const endpoint = pickEndpointRoundRobin(
      serviceRuntime.endpoints,
      `${serviceRuntime.namespace}/${serviceRuntime.serviceName}`,
      counters
    )
    return success(buildHttpBodyFromEndpoint(endpoint))
  }

  return {
    simulateHttpGet
  }
}
