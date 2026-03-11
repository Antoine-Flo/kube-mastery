import type { ExecutionResult } from '../../shared/result'
import { error } from '../../shared/result'

type NameRule = {
  maxLength: number
  regex: RegExp
  regexSource: string
  message: string
  example: string
}

const DNS1123_LABEL_RULE: NameRule = {
  maxLength: 63,
  regex: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/,
  regexSource: '[a-z0-9]([-a-z0-9]*[a-z0-9])?',
  message:
    "a lowercase RFC 1123 label must consist of lower case alphanumeric characters or '-', and must start and end with an alphanumeric character",
  example: 'my-name'
}

const DNS1123_SUBDOMAIN_RULE: NameRule = {
  maxLength: 253,
  regex:
    /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/,
  regexSource:
    '[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*',
  message:
    "a lowercase RFC 1123 subdomain must consist of lower case alphanumeric characters, '-' or '.', and must start and end with an alphanumeric character",
  example: 'example.com'
}

type SupportedKind =
  | 'Pod'
  | 'ConfigMap'
  | 'Secret'
  | 'Node'
  | 'Namespace'
  | 'Ingress'
  | 'ReplicaSet'
  | 'Deployment'
  | 'DaemonSet'
  | 'PersistentVolume'
  | 'PersistentVolumeClaim'
  | 'Service'

const NAME_RULE_BY_KIND: Record<SupportedKind, NameRule> = {
  Pod: DNS1123_SUBDOMAIN_RULE,
  ConfigMap: DNS1123_SUBDOMAIN_RULE,
  Secret: DNS1123_SUBDOMAIN_RULE,
  Node: DNS1123_SUBDOMAIN_RULE,
  Namespace: DNS1123_LABEL_RULE,
  Ingress: DNS1123_SUBDOMAIN_RULE,
  ReplicaSet: DNS1123_SUBDOMAIN_RULE,
  Deployment: DNS1123_SUBDOMAIN_RULE,
  DaemonSet: DNS1123_SUBDOMAIN_RULE,
  PersistentVolume: DNS1123_SUBDOMAIN_RULE,
  PersistentVolumeClaim: DNS1123_SUBDOMAIN_RULE,
  Service: DNS1123_LABEL_RULE
}

const KIND_REFERENCE_BY_KIND: Partial<Record<SupportedKind, string>> = {
  Deployment: 'Deployment.apps',
  DaemonSet: 'DaemonSet.apps',
  ReplicaSet: 'ReplicaSet.apps',
  Ingress: 'Ingress.networking.k8s.io'
}

const toKindReference = (kind: SupportedKind): string => {
  return KIND_REFERENCE_BY_KIND[kind] ?? kind
}

const formatMetadataNameInvalidError = (
  kind: SupportedKind,
  name: string,
  rule: NameRule
): ExecutionResult => {
  const detail =
    `${rule.message} (e.g. '${rule.example}', regex used for validation is '${rule.regexSource}')`
  return error(
    `Error from server (Invalid): ${toKindReference(kind)} "${name}" is invalid: metadata.name: Invalid value: "${name}": ${detail}`
  )
}

export const validateMetadataNameByKind = (
  kind: string,
  name: string
): ExecutionResult | undefined => {
  const rule = NAME_RULE_BY_KIND[kind as SupportedKind]
  if (rule == null) {
    return undefined
  }

  if (name.length > rule.maxLength) {
    return formatMetadataNameInvalidError(kind as SupportedKind, name, rule)
  }
  if (!rule.regex.test(name)) {
    return formatMetadataNameInvalidError(kind as SupportedKind, name, rule)
  }
  return undefined
}

export const validateMetadataNameForResource = (
  resource: unknown
): ExecutionResult | undefined => {
  if (resource == null || typeof resource !== 'object') {
    return undefined
  }
  const kindRaw = (resource as { kind?: unknown }).kind
  const metadataRaw = (resource as { metadata?: unknown }).metadata
  if (typeof kindRaw !== 'string') {
    return undefined
  }
  if (metadataRaw == null || typeof metadataRaw !== 'object') {
    return undefined
  }
  const nameRaw = (metadataRaw as { name?: unknown }).name
  if (typeof nameRaw !== 'string') {
    return undefined
  }
  return validateMetadataNameByKind(kindRaw, nameRaw)
}
