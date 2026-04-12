/**
 * Simulated NetworkPolicy enforcement for pod-to-pod HTTP (TCP) traffic.
 * Not modeled yet: DNS egress, namespaceSelector, ipBlock, matchExpressions,
 * named service ports, SCTP/UDP rules, and curl to a pod IP without service routing.
 */
import type {
  NetworkPolicy,
  NetworkPolicySpec
} from '../cluster/ressources/NetworkPolicy'
import type { Result } from '../shared/result'
import { error, success } from '../shared/result'

/**
 * Pod identity used for NetworkPolicy ingress/egress simulation.
 * Unsupported in MVP: matchExpressions, namespaceSelector, ipBlock, named ports.
 */
export interface SimTrafficPodIdentity {
  name: string
  namespace: string
  labels: Record<string, string>
}

const INGRESS_TYPE = 'Ingress'
const EGRESS_TYPE = 'Egress'
const DEFAULT_PROTOCOL = 'TCP'

const normalizeProtocol = (value: unknown): string => {
  if (typeof value !== 'string' || value.length === 0) {
    return DEFAULT_PROTOCOL
  }
  return value.toUpperCase()
}

const parseNumericPort = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) {
    return value
  }
  if (typeof value === 'string' && value.length > 0) {
    const parsed = Number.parseInt(value, 10)
    if (!Number.isNaN(parsed) && parsed >= 0) {
      return parsed
    }
  }
  return undefined
}

/**
 * Kubernetes: empty or missing podSelector matches all pods in the namespace.
 */
export const networkPolicyPodSelectorMatchesLabels = (
  podSelector: Record<string, unknown> | undefined,
  podLabels: Record<string, string> | undefined
): boolean => {
  if (podSelector == null || Object.keys(podSelector).length === 0) {
    return true
  }
  const matchLabels = podSelector.matchLabels as
    | Record<string, string>
    | undefined
  if (matchLabels != null && typeof matchLabels === 'object') {
    if (podLabels == null) {
      return false
    }
    for (const [key, value] of Object.entries(matchLabels)) {
      if (podLabels[key] !== value) {
        return false
      }
    }
    return true
  }
  const matchExpressions = podSelector.matchExpressions
  if (Array.isArray(matchExpressions) && matchExpressions.length > 0) {
    return false
  }
  return false
}

const policySelectsPod = (
  policy: NetworkPolicy,
  pod: SimTrafficPodIdentity
): boolean => {
  if (policy.metadata.namespace !== pod.namespace) {
    return false
  }
  return networkPolicyPodSelectorMatchesLabels(
    policy.spec.podSelector as Record<string, unknown> | undefined,
    pod.labels
  )
}

type NetworkPolicySpecPolicyTypesSlice = Pick<
  NetworkPolicySpec,
  'policyTypes' | 'ingress' | 'egress'
>

/**
 * Effective policyTypes when omitted: infer from ingress/egress keys; if none, default [Ingress].
 */
export const getEffectiveNetworkPolicyTypes = (
  spec: NetworkPolicySpecPolicyTypesSlice
): Set<string> => {
  const explicit = spec.policyTypes
  if (explicit != null && explicit.length > 0) {
    return new Set(explicit)
  }
  const types = new Set<string>()
  if (Object.prototype.hasOwnProperty.call(spec, 'ingress')) {
    types.add(INGRESS_TYPE)
  }
  if (Object.prototype.hasOwnProperty.call(spec, 'egress')) {
    types.add(EGRESS_TYPE)
  }
  if (types.size === 0) {
    types.add(INGRESS_TYPE)
  }
  return types
}

const portAllowsTraffic = (
  portEntries: unknown,
  protocol: string,
  containerPort: number
): boolean => {
  if (portEntries == null || !Array.isArray(portEntries)) {
    return true
  }
  if (portEntries.length === 0) {
    return true
  }
  for (const entry of portEntries) {
    if (entry == null || typeof entry !== 'object') {
      continue
    }
    const record = entry as Record<string, unknown>
    const ruleProtocol = normalizeProtocol(record.protocol)
    if (ruleProtocol !== protocol) {
      continue
    }
    const rulePort = parseNumericPort(record.port)
    if (rulePort === undefined) {
      continue
    }
    if (rulePort === containerPort) {
      return true
    }
  }
  return false
}

const ingressPeerMatchesSource = (
  peer: Record<string, unknown>,
  policyNamespace: string,
  source: SimTrafficPodIdentity
): boolean => {
  if (source.namespace !== policyNamespace) {
    return false
  }
  const hasNs = Object.prototype.hasOwnProperty.call(peer, 'namespaceSelector')
  const hasIp = Object.prototype.hasOwnProperty.call(peer, 'ipBlock')
  if (hasNs || hasIp) {
    return false
  }
  if (peer.podSelector != null && typeof peer.podSelector === 'object') {
    return networkPolicyPodSelectorMatchesLabels(
      peer.podSelector as Record<string, unknown>,
      source.labels
    )
  }
  return false
}

const egressPeerMatchesTarget = (
  peer: Record<string, unknown>,
  policyNamespace: string,
  target: SimTrafficPodIdentity
): boolean => {
  if (target.namespace !== policyNamespace) {
    return false
  }
  if (peer.podSelector != null && typeof peer.podSelector === 'object') {
    return networkPolicyPodSelectorMatchesLabels(
      peer.podSelector as Record<string, unknown>,
      target.labels
    )
  }
  const hasNs = Object.prototype.hasOwnProperty.call(peer, 'namespaceSelector')
  const hasIp = Object.prototype.hasOwnProperty.call(peer, 'ipBlock')
  if (hasNs || hasIp) {
    return false
  }
  return false
}

const ingressRuleAllows = (
  rule: Record<string, unknown>,
  policyNamespace: string,
  source: SimTrafficPodIdentity,
  protocol: string,
  containerPort: number
): boolean => {
  if (!portAllowsTraffic(rule.ports, protocol, containerPort)) {
    return false
  }
  const fromList = rule.from
  if (fromList == null || !Array.isArray(fromList) || fromList.length === 0) {
    return true
  }
  for (const fromItem of fromList) {
    if (fromItem == null || typeof fromItem !== 'object') {
      continue
    }
    const peer = fromItem as Record<string, unknown>
    if (Object.keys(peer).length === 0) {
      return true
    }
    if (ingressPeerMatchesSource(peer, policyNamespace, source)) {
      return true
    }
  }
  return false
}

const egressRuleAllows = (
  rule: Record<string, unknown>,
  policyNamespace: string,
  target: SimTrafficPodIdentity,
  protocol: string,
  containerPort: number
): boolean => {
  if (!portAllowsTraffic(rule.ports, protocol, containerPort)) {
    return false
  }
  const toList = rule.to
  if (toList == null || !Array.isArray(toList) || toList.length === 0) {
    return true
  }
  for (const toItem of toList) {
    if (toItem == null || typeof toItem !== 'object') {
      continue
    }
    const peer = toItem as Record<string, unknown>
    if (Object.keys(peer).length === 0) {
      return true
    }
    if (egressPeerMatchesTarget(peer, policyNamespace, target)) {
      return true
    }
  }
  return false
}

const policyContributesIngressAllow = (
  policy: NetworkPolicy,
  source: SimTrafficPodIdentity,
  protocol: string,
  containerPort: number
): boolean => {
  const types = getEffectiveNetworkPolicyTypes(policy.spec)
  if (!types.has(INGRESS_TYPE)) {
    return false
  }
  const rules = policy.spec.ingress
  if (rules == null || !Array.isArray(rules) || rules.length === 0) {
    return false
  }
  const ns = policy.metadata.namespace
  for (const rule of rules) {
    if (rule == null || typeof rule !== 'object') {
      continue
    }
    if (
      ingressRuleAllows(
        rule as Record<string, unknown>,
        ns,
        source,
        protocol,
        containerPort
      )
    ) {
      return true
    }
  }
  return false
}

const policyContributesEgressAllow = (
  policy: NetworkPolicy,
  target: SimTrafficPodIdentity,
  protocol: string,
  containerPort: number
): boolean => {
  const types = getEffectiveNetworkPolicyTypes(policy.spec)
  if (!types.has(EGRESS_TYPE)) {
    return false
  }
  const rules = policy.spec.egress
  if (rules == null || !Array.isArray(rules) || rules.length === 0) {
    return false
  }
  const ns = policy.metadata.namespace
  for (const rule of rules) {
    if (rule == null || typeof rule !== 'object') {
      continue
    }
    if (
      egressRuleAllows(
        rule as Record<string, unknown>,
        ns,
        target,
        protocol,
        containerPort
      )
    ) {
      return true
    }
  }
  return false
}

const isIngressRestrictedForPod = (
  policies: NetworkPolicy[],
  target: SimTrafficPodIdentity
): boolean => {
  const selecting = policies.filter((p) => {
    return policySelectsPod(p, target)
  })
  if (selecting.length === 0) {
    return false
  }
  for (const policy of selecting) {
    const types = getEffectiveNetworkPolicyTypes(policy.spec)
    if (types.has(INGRESS_TYPE)) {
      return true
    }
  }
  return false
}

const isEgressRestrictedForPod = (
  policies: NetworkPolicy[],
  source: SimTrafficPodIdentity
): boolean => {
  const selecting = policies.filter((p) => {
    return policySelectsPod(p, source)
  })
  if (selecting.length === 0) {
    return false
  }
  for (const policy of selecting) {
    const types = getEffectiveNetworkPolicyTypes(policy.spec)
    if (types.has(EGRESS_TYPE)) {
      return true
    }
  }
  return false
}

const ingressAllowedByUnion = (
  policies: NetworkPolicy[],
  target: SimTrafficPodIdentity,
  source: SimTrafficPodIdentity,
  protocol: string,
  containerPort: number
): boolean => {
  const selecting = policies.filter((p) => {
    return policySelectsPod(p, target)
  })
  if (selecting.length === 0) {
    return true
  }
  let anyIngressType = false
  for (const policy of selecting) {
    const types = getEffectiveNetworkPolicyTypes(policy.spec)
    if (!types.has(INGRESS_TYPE)) {
      continue
    }
    anyIngressType = true
    if (
      policyContributesIngressAllow(policy, source, protocol, containerPort)
    ) {
      return true
    }
  }
  if (!anyIngressType) {
    return true
  }
  return false
}

const egressAllowedByUnion = (
  policies: NetworkPolicy[],
  source: SimTrafficPodIdentity,
  target: SimTrafficPodIdentity,
  protocol: string,
  containerPort: number
): boolean => {
  const selecting = policies.filter((p) => {
    return policySelectsPod(p, source)
  })
  if (selecting.length === 0) {
    return true
  }
  let anyEgressType = false
  for (const policy of selecting) {
    const types = getEffectiveNetworkPolicyTypes(policy.spec)
    if (!types.has(EGRESS_TYPE)) {
      continue
    }
    anyEgressType = true
    if (policyContributesEgressAllow(policy, target, protocol, containerPort)) {
      return true
    }
  }
  if (!anyEgressType) {
    return true
  }
  return false
}

export interface EvaluateSimulatedPodTrafficInput {
  policiesInTargetNamespace: NetworkPolicy[]
  policiesInSourceNamespace: NetworkPolicy[]
  sourcePod: SimTrafficPodIdentity | undefined
  targetPod: SimTrafficPodIdentity
  protocol: string
  targetContainerPort: number
  curlErrorHost: string
  urlPort: number
}

/**
 * Returns success when simulated pod-to-pod TCP traffic is allowed by the
 * union of NetworkPolicies in each namespace (MVP: matchLabels, same-namespace peers).
 */
export const evaluateSimulatedPodTraffic = (
  input: EvaluateSimulatedPodTrafficInput
): Result<void> => {
  const protocol = input.protocol.toUpperCase()
  const { targetPod, sourcePod, targetContainerPort } = input

  if (!isIngressRestrictedForPod(input.policiesInTargetNamespace, targetPod)) {
    if (sourcePod == null) {
      return success(undefined)
    }
    if (!isEgressRestrictedForPod(input.policiesInSourceNamespace, sourcePod)) {
      return success(undefined)
    }
    const egressOk = egressAllowedByUnion(
      input.policiesInSourceNamespace,
      sourcePod,
      targetPod,
      protocol,
      targetContainerPort
    )
    if (!egressOk) {
      return error(
        `curl: (7) Failed to connect to ${input.curlErrorHost} port ${input.urlPort}`
      )
    }
    return success(undefined)
  }

  if (sourcePod == null) {
    const anonymousIngressSource: SimTrafficPodIdentity = {
      name: 'unknown',
      namespace: '',
      labels: {}
    }
    const ingressOk = ingressAllowedByUnion(
      input.policiesInTargetNamespace,
      targetPod,
      anonymousIngressSource,
      protocol,
      targetContainerPort
    )
    if (!ingressOk) {
      return error(
        `curl: (7) Failed to connect to ${input.curlErrorHost} port ${input.urlPort}`
      )
    }
    return success(undefined)
  }

  const ingressOk = ingressAllowedByUnion(
    input.policiesInTargetNamespace,
    targetPod,
    sourcePod,
    protocol,
    targetContainerPort
  )
  if (!ingressOk) {
    return error(
      `curl: (7) Failed to connect to ${input.curlErrorHost} port ${input.urlPort}`
    )
  }

  if (!isEgressRestrictedForPod(input.policiesInSourceNamespace, sourcePod)) {
    return success(undefined)
  }

  const egressOk = egressAllowedByUnion(
    input.policiesInSourceNamespace,
    sourcePod,
    targetPod,
    protocol,
    targetContainerPort
  )
  if (!egressOk) {
    return error(
      `curl: (7) Failed to connect to ${input.curlErrorHost} port ${input.urlPort}`
    )
  }

  return success(undefined)
}
