import type {
  Ingress,
  IngressBackend
} from '../../../cluster/ressources/Ingress'
import { formatLabels } from '../internal/helpers'

const formatIngressBackendDescribe = (backend: IngressBackend): string => {
  const serviceBackend = backend.service
  if (serviceBackend != null) {
    const port = serviceBackend.port.number ?? serviceBackend.port.name
    if (port == null) {
      return `${serviceBackend.name} ()`
    }
    return `${serviceBackend.name}:${String(port)} ()`
  }
  const resourceRef = backend.resource
  if (resourceRef != null) {
    const groupPrefix =
      resourceRef.apiGroup != null && resourceRef.apiGroup.length > 0
        ? `${resourceRef.apiGroup}/`
        : ''
    const kind = resourceRef.kind ?? 'Resource'
    return `${groupPrefix}${kind}/${resourceRef.name}`
  }
  return '<unknown>'
}

export const describeIngress = (ingress: Ingress): string => {
  const resolveDefaultBackend = (): string => {
    const defaultBackend = ingress.spec.defaultBackend
    if (defaultBackend == null) {
      return '<default>'
    }
    return formatIngressBackendDescribe(defaultBackend)
  }
  const rules = ingress.spec.rules ?? []
  const hostColumnWidth =
    Math.max(
      'Host'.length,
      ...rules.map((rule) => {
        return (rule.host ?? '*').length
      })
    ) + 2
  const lines: string[] = []
  lines.push(`Name:             ${ingress.metadata.name}`)
  lines.push(`Labels:           ${formatLabels(ingress.metadata.labels)}`)
  lines.push(`Namespace:        ${ingress.metadata.namespace}`)
  lines.push(`Address:          `)
  lines.push(`Ingress Class:    ${ingress.spec.ingressClassName ?? '<none>'}`)
  lines.push(`Default backend:  ${resolveDefaultBackend()}`)
  lines.push(`Rules:`)
  lines.push(`  ${'Host'.padEnd(hostColumnWidth)}Path  Backends`)
  lines.push(`  ${'----'.padEnd(hostColumnWidth)}----  --------`)

  for (const rule of rules) {
    const host = rule.host ?? '*'
    lines.push(`  ${host.padEnd(hostColumnWidth)}`)
    const paths = rule.http?.paths ?? []
    for (const pathRule of paths) {
      const pathText = pathRule.path ?? ''
      lines.push(
        `  ${''.padEnd(hostColumnWidth)}${pathText.padEnd(6)} ${formatIngressBackendDescribe(pathRule.backend)}`
      )
    }
  }

  const tlsEntries = ingress.spec.tls
  if (tlsEntries != null && tlsEntries.length > 0) {
    lines.push('TLS:')
    for (const tls of tlsEntries) {
      const hostsJoined =
        tls.hosts != null && tls.hosts.length > 0 ? tls.hosts.join(', ') : '*'
      const secret = tls.secretName ?? ''
      const secretLabel = secret.length > 0 ? secret : '<no secret>'
      lines.push(`  ${secretLabel} terminates ${hostsJoined}`)
    }
  }

  lines.push(
    `Annotations:        ${formatLabels(ingress.metadata.annotations)}`
  )
  lines.push(`Events:             <none>`)
  return lines.join('\n')
}
