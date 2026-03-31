import type { Ingress } from '../../../../../cluster/ressources/Ingress'
import type { SecretType } from '../../../../../cluster/ressources/Secret'
import type { Service } from '../../../../../cluster/ressources/Service'

export const getSecretType = (secretType: SecretType): string => {
  return secretType.type
}

export const getServiceExternalIP = (service: Service): string => {
  const serviceType = service.spec.type ?? 'ClusterIP'
  if (
    service.status?.loadBalancer?.ingress &&
    service.status.loadBalancer.ingress.length > 0
  ) {
    const ingress = service.status.loadBalancer.ingress[0]
    return ingress.ip || ingress.hostname || '<pending>'
  }
  if (service.spec.externalIPs && service.spec.externalIPs.length > 0) {
    return service.spec.externalIPs.join(',')
  }
  if (serviceType === 'LoadBalancer') {
    return '<pending>'
  }
  return '<none>'
}

export const formatServicePorts = (service: Service): string => {
  if (!service.spec.ports || service.spec.ports.length === 0) {
    return '<none>'
  }
  return service.spec.ports
    .map((port) => {
      const portStr = port.nodePort
        ? `${port.nodePort}:${port.port}`
        : String(port.port)
      const protocol = port.protocol || 'TCP'
      return `${portStr}/${protocol}`
    })
    .join(',')
}

export const formatIngressClass = (ingress: Ingress): string => {
  return ingress.spec.ingressClassName ?? '<none>'
}

export const formatIngressHosts = (ingress: Ingress): string => {
  const hosts = ingress.spec.rules
    .map((rule) => rule.host)
    .filter((host): host is string => host != null && host.length > 0)
  if (hosts.length === 0) {
    return '*'
  }
  return hosts.join(',')
}

export const formatIngressPorts = (): string => {
  return '80'
}

export const formatNodeSelector = (
  selector?: Record<string, string>
): string => {
  if (selector == null) {
    return '<none>'
  }
  const entries = Object.entries(selector)
  if (entries.length === 0) {
    return '<none>'
  }
  return entries
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([key, value]) => `${key}=${value}`)
    .join(',')
}
