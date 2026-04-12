import type { NetworkPolicy } from '../../../cluster/ressources/NetworkPolicy'
import { formatDescribeDate, formatLabels } from '../internal/helpers'

const formatNetworkPolicyLabelSelector = (
  podSelector: Record<string, unknown> | undefined
): string => {
  if (podSelector == null || typeof podSelector !== 'object') {
    return ''
  }
  const parts: string[] = []
  const matchLabels = podSelector.matchLabels
  if (matchLabels != null && typeof matchLabels === 'object') {
    const entries = Object.entries(matchLabels as Record<string, string>).sort(
      ([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)
    )
    for (const [key, value] of entries) {
      parts.push(`${key}=${value}`)
    }
  }
  const matchExpressions = podSelector.matchExpressions
  if (Array.isArray(matchExpressions)) {
    for (const expr of matchExpressions) {
      if (expr == null || typeof expr !== 'object') {
        continue
      }
      const requirement = expr as {
        key?: string
        operator?: string
        values?: string[]
      }
      const key = requirement.key ?? ''
      const operator = requirement.operator ?? ''
      const valuesJoined =
        requirement.values != null && requirement.values.length > 0
          ? requirement.values.join(',')
          : ''
      parts.push(`${key} ${operator} (${valuesJoined})`)
    }
  }
  return parts.join(',')
}

const networkPolicyPolicyTypesString = (
  policyTypes: string[] | undefined
): string => {
  if (policyTypes == null || policyTypes.length === 0) {
    return ' '
  }
  return policyTypes.join(', ')
}

const getNetworkPolicyIngressEgressFlags = (
  policyTypes: string[] | undefined
): { ingress: boolean; egress: boolean } => {
  let ingress = false
  let egress = false
  if (policyTypes == null) {
    return { ingress, egress }
  }
  for (const policyType of policyTypes) {
    if (policyType === 'Ingress') {
      ingress = true
    }
    if (policyType === 'Egress') {
      egress = true
    }
  }
  return { ingress, egress }
}

/** Matches kubectl describe indentation under "Allowing ingress/egress traffic:" */
const NP_RULE_LINE = '    '
const NP_RULE_PEER = '      '
const NP_RULE_IP = '        '

const formatNetworkPolicyPortLine = (
  initialIndent: string,
  portEntry: Record<string, unknown>
): string[] => {
  const lines: string[] = []
  const protocolRaw = portEntry.protocol
  const protocol =
    typeof protocolRaw === 'string' && protocolRaw.length > 0
      ? protocolRaw
      : 'TCP'
  const port = portEntry.port
  const endPort = portEntry.endPort
  if (endPort == null) {
    lines.push(`${initialIndent}To Port: ${String(port)}/${protocol}`)
  } else {
    lines.push(
      `${initialIndent}To Port Range: ${String(port)}-${String(endPort)}/${protocol}`
    )
  }
  return lines
}

const appendNetworkPolicyIngressRules = (
  lines: string[],
  ingressRules: Record<string, unknown>[] | undefined
): void => {
  if (ingressRules == null || ingressRules.length === 0) {
    lines.push(
      `${NP_RULE_LINE}(Selected pods are isolated for ingress connectivity)`
    )
    return
  }
  for (let index = 0; index < ingressRules.length; index++) {
    const rule = ingressRules[index]
    const ports = rule.ports
    if (!Array.isArray(ports) || ports.length === 0) {
      lines.push(`${NP_RULE_LINE}To Port: (traffic allowed to all ports)`)
    } else {
      for (const portEntry of ports) {
        if (portEntry != null && typeof portEntry === 'object') {
          const portLines = formatNetworkPolicyPortLine(
            NP_RULE_LINE,
            portEntry as Record<string, unknown>
          )
          for (const line of portLines) {
            lines.push(line)
          }
        }
      }
    }
    const fromList = rule.from
    if (!Array.isArray(fromList) || fromList.length === 0) {
      lines.push(`${NP_RULE_LINE}From: (traffic not restricted by source)`)
    } else {
      for (const fromEntry of fromList) {
        if (fromEntry == null || typeof fromEntry !== 'object') {
          continue
        }
        const from = fromEntry as Record<string, unknown>
        lines.push(`${NP_RULE_LINE}From:`)
        const podSelector = from.podSelector as Record<string, unknown> | null
        const namespaceSelector = from.namespaceSelector as Record<
          string,
          unknown
        > | null
        const ipBlock = from.ipBlock as Record<string, unknown> | null
        if (podSelector != null && namespaceSelector != null) {
          lines.push(
            `${NP_RULE_PEER}NamespaceSelector: ${formatNetworkPolicyLabelSelector(namespaceSelector)}`
          )
          lines.push(
            `${NP_RULE_PEER}PodSelector: ${formatNetworkPolicyLabelSelector(podSelector)}`
          )
        } else if (podSelector != null) {
          lines.push(
            `${NP_RULE_PEER}PodSelector: ${formatNetworkPolicyLabelSelector(podSelector)}`
          )
        } else if (namespaceSelector != null) {
          lines.push(
            `${NP_RULE_PEER}NamespaceSelector: ${formatNetworkPolicyLabelSelector(namespaceSelector)}`
          )
        } else if (ipBlock != null) {
          lines.push(`${NP_RULE_PEER}IPBlock:`)
          const cidr = ipBlock.cidr
          lines.push(`${NP_RULE_IP}CIDR: ${String(cidr ?? '')}`)
          const except = ipBlock.except
          const exceptJoined = Array.isArray(except)
            ? except.map((value) => String(value)).join(', ')
            : ''
          lines.push(`${NP_RULE_IP}Except: ${exceptJoined}`)
        }
      }
    }
    if (index !== ingressRules.length - 1) {
      lines.push(`${NP_RULE_LINE}----------`)
    }
  }
}

const appendNetworkPolicyEgressRules = (
  lines: string[],
  egressRules: Record<string, unknown>[] | undefined
): void => {
  if (egressRules == null || egressRules.length === 0) {
    lines.push(
      `${NP_RULE_LINE}(Selected pods are isolated for egress connectivity)`
    )
    return
  }
  for (let index = 0; index < egressRules.length; index++) {
    const rule = egressRules[index]
    const ports = rule.ports
    if (!Array.isArray(ports) || ports.length === 0) {
      lines.push(`${NP_RULE_LINE}To Port: (traffic allowed to all ports)`)
    } else {
      for (const portEntry of ports) {
        if (portEntry != null && typeof portEntry === 'object') {
          const portLines = formatNetworkPolicyPortLine(
            NP_RULE_LINE,
            portEntry as Record<string, unknown>
          )
          for (const line of portLines) {
            lines.push(line)
          }
        }
      }
    }
    const toList = rule.to
    if (!Array.isArray(toList) || toList.length === 0) {
      lines.push(`${NP_RULE_LINE}To: (traffic not restricted by destination)`)
    } else {
      for (const toEntry of toList) {
        if (toEntry == null || typeof toEntry !== 'object') {
          continue
        }
        const to = toEntry as Record<string, unknown>
        lines.push(`${NP_RULE_LINE}To:`)
        const podSelector = to.podSelector as Record<string, unknown> | null
        const namespaceSelector = to.namespaceSelector as Record<
          string,
          unknown
        > | null
        const ipBlock = to.ipBlock as Record<string, unknown> | null
        if (podSelector != null && namespaceSelector != null) {
          lines.push(
            `${NP_RULE_PEER}NamespaceSelector: ${formatNetworkPolicyLabelSelector(namespaceSelector)}`
          )
          lines.push(
            `${NP_RULE_PEER}PodSelector: ${formatNetworkPolicyLabelSelector(podSelector)}`
          )
        } else if (podSelector != null) {
          lines.push(
            `${NP_RULE_PEER}PodSelector: ${formatNetworkPolicyLabelSelector(podSelector)}`
          )
        } else if (namespaceSelector != null) {
          lines.push(
            `${NP_RULE_PEER}NamespaceSelector: ${formatNetworkPolicyLabelSelector(namespaceSelector)}`
          )
        } else if (ipBlock != null) {
          lines.push(`${NP_RULE_PEER}IPBlock:`)
          const cidr = ipBlock.cidr
          lines.push(`${NP_RULE_IP}CIDR: ${String(cidr ?? '')}`)
          const except = ipBlock.except
          const exceptJoined = Array.isArray(except)
            ? except.map((value) => String(value)).join(', ')
            : ''
          lines.push(`${NP_RULE_IP}Except: ${exceptJoined}`)
        }
      }
    }
    if (index !== egressRules.length - 1) {
      lines.push(`${NP_RULE_LINE}----------`)
    }
  }
}

export const describeNetworkPolicy = (networkPolicy: NetworkPolicy): string => {
  const lines: string[] = []
  lines.push(`Name:         ${networkPolicy.metadata.name}`)
  lines.push(`Namespace:    ${networkPolicy.metadata.namespace}`)
  lines.push(
    `Created on:   ${formatDescribeDate(networkPolicy.metadata.creationTimestamp)}`
  )
  lines.push(`Labels:       ${formatLabels(networkPolicy.metadata.labels)}`)
  lines.push(
    `Annotations:  ${formatLabels(networkPolicy.metadata.annotations)}`
  )
  lines.push('Spec:')
  const podSelector = networkPolicy.spec.podSelector
  const selectorStr = formatNetworkPolicyLabelSelector(podSelector)
  if (selectorStr.length === 0) {
    lines.push(
      '  PodSelector:      (Allowing the specific traffic to all pods in this namespace)'
    )
  } else {
    lines.push(`  PodSelector:     ${selectorStr}`)
  }
  const policyTypes = networkPolicy.spec.policyTypes
  const { ingress: ingressEnabled, egress: egressEnabled } =
    getNetworkPolicyIngressEgressFlags(policyTypes)
  if (ingressEnabled) {
    lines.push('  Allowing ingress traffic:')
    appendNetworkPolicyIngressRules(lines, networkPolicy.spec.ingress)
  } else {
    lines.push('  Not affecting ingress traffic')
  }
  if (egressEnabled) {
    lines.push('  Allowing egress traffic:')
    appendNetworkPolicyEgressRules(lines, networkPolicy.spec.egress)
  } else {
    lines.push('  Not affecting egress traffic')
  }
  lines.push(`  Policy Types: ${networkPolicyPolicyTypesString(policyTypes)}`)
  return lines.join('\n')
}
