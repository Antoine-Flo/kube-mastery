import type { KindToResource, ResourceKind } from '../../cluster/ClusterState'
import type { ApiServerFacade } from '../../api/ApiServerFacade'
import type { ExecutionResult, Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { Resource } from './types'
import {
  KUBECTL_RESOURCES,
  KIND_REFERENCE_BY_KIND,
  NAMESPACED_RESOURCE_KINDS,
  PLURAL_KIND_REFERENCE_BY_KIND,
  RESOURCE_DISCOVERY_REF_BY_RESOURCE,
  RESOURCE_KIND_BY_RESOURCE,
  RESOURCE_OUTPUT_METADATA_BY_RESOURCE,
  SUPPORTED_RESOURCE_KINDS,
  type KubectlResource
} from './resourceCatalog.generated'

export {
  KUBECTL_RESOURCES,
  NAMESPACED_RESOURCE_KINDS,
  RESOURCE_KIND_BY_RESOURCE,
  RESOURCE_OUTPUT_METADATA_BY_RESOURCE,
  SUPPORTED_RESOURCE_KINDS
}
export type { KubectlResource }

const buildResourceAliasMap = (): Record<string, KubectlResource> => {
  const map: Record<string, KubectlResource> = {} as Record<
    string,
    KubectlResource
  >
  for (const [canonical, aliases] of Object.entries(KUBECTL_RESOURCES)) {
    for (const alias of aliases) {
      map[alias] = canonical as KubectlResource
    }
  }
  return map
}

export const RESOURCE_ALIAS_MAP = buildResourceAliasMap()

const KUBECTL_RESOURCE_KINDS = Object.keys(
  KUBECTL_RESOURCES
) as KubectlResource[]

export const resolveUniqueKubectlResourceKindAllowlist = (
  prefix: string,
  allowedKinds: readonly KubectlResource[]
): KubectlResource | null => {
  if (prefix === '') {
    return null
  }
  const matched: KubectlResource[] = []
  for (const canonical of allowedKinds) {
    const aliases = KUBECTL_RESOURCES[canonical]
    const forms: readonly string[] = [canonical, ...aliases]
    const hasMatch = forms.some((form) => {
      return form.startsWith(prefix)
    })
    if (hasMatch) {
      matched.push(canonical)
    }
  }
  if (matched.length !== 1) {
    return null
  }
  return matched[0]
}

export const resolveUniqueKubectlResourceKind = (
  prefix: string
): KubectlResource | null => {
  return resolveUniqueKubectlResourceKindAllowlist(prefix, KUBECTL_RESOURCE_KINDS)
}

export const isSupportedResourceKind = (kind: string): kind is ResourceKind => {
  return SUPPORTED_RESOURCE_KINDS.includes(kind as ResourceKind)
}

export const isNamespacedResourceKind = (kind: ResourceKind): boolean => {
  return NAMESPACED_RESOURCE_KINDS.includes(kind)
}

export const toKindReference = (kind: ResourceKind): string => {
  return KIND_REFERENCE_BY_KIND[kind]
}

export const toPluralKindReference = (kind: ResourceKind): string => {
  return PLURAL_KIND_REFERENCE_BY_KIND[kind]
}

export const toKindReferenceForValidation = (kind: ResourceKind): string => {
  const kindReference = toKindReference(kind)
  const [resource, ...group] = kindReference.split('.')
  const capitalizedResource = `${resource.charAt(0).toUpperCase()}${resource.slice(1)}`
  if (group.length === 0) {
    return capitalizedResource
  }
  return `${capitalizedResource}.${group.join('.')}`
}

export const toResourceKindReference = (resource: Resource): string => {
  if (resource === 'all') {
    return 'resource'
  }
  const discovery = RESOURCE_DISCOVERY_REF_BY_RESOURCE[resource]
  if (discovery != null) {
    return discovery.singular
  }
  const resourceKind = RESOURCE_KIND_BY_RESOURCE[resource]
  if (resourceKind == null) {
    return resource
  }
  return toKindReference(resourceKind)
}

export const toPluralResourceKindReference = (resource: Resource): string => {
  if (resource === 'all') {
    return 'resources'
  }
  const discovery = RESOURCE_DISCOVERY_REF_BY_RESOURCE[resource]
  if (discovery != null) {
    return discovery.plural
  }
  const resourceKind = RESOURCE_KIND_BY_RESOURCE[resource]
  if (resourceKind == null) {
    return resource
  }
  return toPluralKindReference(resourceKind)
}

export type ParsedResourceTarget = {
  resource: Resource
  name?: string
  usesTypeNameSyntax: boolean
}

export const parseResourceTargetToken = (
  token: string | undefined
): Result<ParsedResourceTarget> => {
  if (!token || token.startsWith('-')) {
    return error('Invalid or missing resource type')
  }

  if (!token.includes('/')) {
    const resource = RESOURCE_ALIAS_MAP[token] as Resource | undefined
    if (!resource) {
      return error('Invalid or missing resource type')
    }
    return success({
      resource,
      usesTypeNameSyntax: false
    })
  }

  const [resourceToken, nameToken] = token.split('/', 2)
  const resource = RESOURCE_ALIAS_MAP[resourceToken] as Resource | undefined
  if (!resource) {
    return error('Invalid or missing resource type')
  }

  return success({
    resource,
    name: nameToken && nameToken.length > 0 ? nameToken : undefined,
    usesTypeNameSyntax: true
  })
}

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
  regex: /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/,
  regexSource:
    '[a-z0-9]([-a-z0-9]*[a-z0-9])?(\\.[a-z0-9]([-a-z0-9]*[a-z0-9])?)*',
  message:
    "a lowercase RFC 1123 subdomain must consist of lower case alphanumeric characters, '-' or '.', and must start and end with an alphanumeric character",
  example: 'example.com'
}

type SupportedKind = ResourceKind

const NAME_RULE_BY_KIND: Record<SupportedKind, NameRule> = {
  Pod: DNS1123_SUBDOMAIN_RULE,
  Event: DNS1123_SUBDOMAIN_RULE,
  ConfigMap: DNS1123_SUBDOMAIN_RULE,
  ControllerRevision: DNS1123_SUBDOMAIN_RULE,
  Secret: DNS1123_SUBDOMAIN_RULE,
  Node: DNS1123_SUBDOMAIN_RULE,
  Namespace: DNS1123_LABEL_RULE,
  Ingress: DNS1123_SUBDOMAIN_RULE,
  NetworkPolicy: DNS1123_SUBDOMAIN_RULE,
  ReplicaSet: DNS1123_SUBDOMAIN_RULE,
  Deployment: DNS1123_SUBDOMAIN_RULE,
  DaemonSet: DNS1123_SUBDOMAIN_RULE,
  StatefulSet: DNS1123_SUBDOMAIN_RULE,
  PersistentVolume: DNS1123_SUBDOMAIN_RULE,
  PersistentVolumeClaim: DNS1123_SUBDOMAIN_RULE,
  Service: DNS1123_LABEL_RULE,
  EndpointSlice: DNS1123_SUBDOMAIN_RULE,
  Endpoints: DNS1123_SUBDOMAIN_RULE,
  Lease: DNS1123_SUBDOMAIN_RULE,
  StorageClass: DNS1123_SUBDOMAIN_RULE
}

const formatMetadataNameInvalidError = (
  kind: SupportedKind,
  name: string,
  rule: NameRule
): ExecutionResult => {
  const detail = `${rule.message} (e.g. '${rule.example}', regex used for validation is '${rule.regexSource}')`
  return error(
    `Error from server (Invalid): ${toKindReferenceForValidation(kind)} "${name}" is invalid: metadata.name: Invalid value: "${name}": ${detail}`
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

export type KubernetesResource = {
  kind: string
  metadata: {
    name: string
    namespace: string
  }
}

const LAST_APPLIED_CONFIGURATION_ANNOTATION =
  'kubectl.kubernetes.io/last-applied-configuration'

const validateNamespaceExists = (
  apiServer: ApiServerFacade,
  kind: ResourceKind,
  namespace: string
): ExecutionResult | undefined => {
  if (!isNamespacedResourceKind(kind)) {
    return undefined
  }
  const namespaceResult = apiServer.findResource('Namespace', namespace)
  if (namespaceResult.ok) {
    return undefined
  }
  return error(
    `Error from server (NotFound): namespaces "${namespace}" not found`
  )
}

const buildComparableResource = (
  value: unknown,
  parentKey?: string,
  isRoot = false
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => buildComparableResource(item, undefined, false))
  }
  if (value == null || typeof value !== 'object') {
    return value
  }

  const recordValue = value as Record<string, unknown>
  const comparable: Record<string, unknown> = {}
  const keys = Object.keys(recordValue).sort((left, right) => {
    return left.localeCompare(right)
  })

  for (const key of keys) {
    if (key === '_simulator') {
      continue
    }
    if (isRoot && key === 'status') {
      continue
    }
    if (
      parentKey === 'metadata' &&
      (key === 'creationTimestamp' || key === 'generation')
    ) {
      continue
    }
    if (parentKey === 'metadata' && key === 'annotations') {
      const annotationsRaw = recordValue[key]
      if (annotationsRaw == null || typeof annotationsRaw !== 'object') {
        continue
      }
      const annotations = annotationsRaw as Record<string, unknown>
      const filteredEntries = Object.entries(annotations).filter(([annKey]) => {
        if (annKey === 'deployment.kubernetes.io/revision') {
          return false
        }
        if (annKey === LAST_APPLIED_CONFIGURATION_ANNOTATION) {
          return false
        }
        if (annKey.startsWith('sim.kubernetes.io/')) {
          return false
        }
        return true
      })
      if (filteredEntries.length === 0) {
        continue
      }
      comparable[key] = buildComparableResource(
        Object.fromEntries(filteredEntries),
        key,
        false
      )
      continue
    }
    comparable[key] = buildComparableResource(recordValue[key], key, false)
  }

  return comparable
}

const areResourcesEquivalentForApply = (
  currentResource: unknown,
  incomingResource: unknown
): boolean => {
  const currentComparable = buildComparableResource(
    currentResource,
    undefined,
    true
  )
  const incomingComparable = buildComparableResource(
    incomingResource,
    undefined,
    true
  )
  return (
    JSON.stringify(currentComparable) === JSON.stringify(incomingComparable)
  )
}

export const applyResourceWithEvents = (
  resource: KubernetesResource,
  apiServer: ApiServerFacade
): ExecutionResult => {
  const { name, namespace } = resource.metadata
  const kindRaw = resource.kind

  if (!isSupportedResourceKind(kindRaw)) {
    return error(
      `error: the server doesn't have a resource type "${kindRaw.toLowerCase()}s"`
    )
  }
  const kind = kindRaw as ResourceKind

  const metadataNameValidation = validateMetadataNameByKind(kind, name)
  if (metadataNameValidation != null) {
    return metadataNameValidation
  }

  const namespaceValidation = validateNamespaceExists(
    apiServer,
    kind,
    namespace
  )
  if (namespaceValidation != null) {
    return namespaceValidation
  }

  const existing = apiServer.findResource(kind, name, namespace)

  if (existing.ok) {
    if (areResourcesEquivalentForApply(existing.value, resource)) {
      return success(`${toKindReference(kind)}/${name} unchanged`)
    }
    const updateResult = apiServer.updateResource(
      kind,
      name,
      resource as unknown as KindToResource<typeof kind>,
      namespace
    )
    if (!updateResult.ok) {
      return error(updateResult.error)
    }
    return success(`${toKindReference(kind)}/${name} configured`)
  }
  const createResult = apiServer.createResource(
    kind,
    resource as unknown as KindToResource<typeof kind>,
    namespace
  )
  if (!createResult.ok) {
    return error(createResult.error)
  }
  return success(`${toKindReference(kind)}/${name} created`)
}

export const createResourceWithEvents = (
  resource: KubernetesResource,
  apiServer: ApiServerFacade
): ExecutionResult => {
  const { name, namespace } = resource.metadata
  const kindRaw = resource.kind

  if (!isSupportedResourceKind(kindRaw)) {
    return error(
      `error: the server doesn't have a resource type "${kindRaw.toLowerCase()}s"`
    )
  }
  const kind = kindRaw as ResourceKind

  const metadataNameValidation = validateMetadataNameByKind(kind, name)
  if (metadataNameValidation != null) {
    return metadataNameValidation
  }

  const namespaceValidation = validateNamespaceExists(
    apiServer,
    kind,
    namespace
  )
  if (namespaceValidation != null) {
    return namespaceValidation
  }

  const existing = apiServer.findResource(kind, name, namespace)
  if (existing.ok) {
    return error(
      `Error from server (AlreadyExists): ${toPluralKindReference(kind)} "${name}" already exists`
    )
  }

  const createResult = apiServer.createResource(
    kind,
    resource as unknown as KindToResource<typeof kind>,
    namespace
  )
  if (!createResult.ok) {
    return error(createResult.error)
  }

  return success(`${toKindReference(kind)}/${name} created`)
}
