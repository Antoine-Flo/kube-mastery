import { createTwoFilesPatch } from 'diff'
import { stringify as yamlStringify } from 'yaml'
import {
  type ClusterStateData,
  type ResourceKind
} from '../../../cluster/ClusterState'
import {
  createApiServerFacade,
  type ApiServerFacade
} from '../../../api/ApiServerFacade'
import type { FileSystem } from '../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import { parseKubernetesYaml } from '../../yamlParser'
import type { ParsedCommand } from '../types'
import {
  applyResourceWithEvents,
  type KubernetesResource
} from './resourceHelpers'

type GenericObject = Record<string, unknown>

const SENSITIVE_MASK_DEFAULT = '***'
const SENSITIVE_MASK_BEFORE = '*** (before)'
const SENSITIVE_MASK_AFTER = '*** (after)'
const DIFF_TOP_LEVEL_KEY_ORDER = [
  'apiVersion',
  'data',
  'kind',
  'metadata',
  'type',
  'stringData',
  'binaryData',
  'spec',
  'status'
]

const getFilenameFromFlags = (parsed: ParsedCommand): string | undefined => {
  const filename = parsed.flags.f || parsed.flags.filename
  if (typeof filename !== 'string') {
    return undefined
  }
  return filename
}

const cloneObject = <T>(value: T): T => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value)
  }
  return JSON.parse(JSON.stringify(value)) as T
}

const toComparableSecretType = (value: unknown): unknown => {
  if (value == null || typeof value !== 'object') {
    return value
  }
  const asObject = value as GenericObject
  const typeValue = asObject.type
  if (typeof typeValue === 'string') {
    return typeValue
  }
  return value
}

const orderObjectKeys = (value: unknown, isTopLevel = false): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => orderObjectKeys(item, false))
  }
  if (value == null || typeof value !== 'object') {
    return value
  }

  const objectValue = value as GenericObject
  const entries = Object.entries(objectValue)
  const sortedEntries = [...entries].sort(([left], [right]) => {
    if (isTopLevel) {
      const leftOrder = DIFF_TOP_LEVEL_KEY_ORDER.indexOf(left)
      const rightOrder = DIFF_TOP_LEVEL_KEY_ORDER.indexOf(right)
      if (leftOrder !== -1 && rightOrder !== -1) {
        return leftOrder - rightOrder
      }
      if (leftOrder !== -1) {
        return -1
      }
      if (rightOrder !== -1) {
        return 1
      }
    }
    return left.localeCompare(right)
  })

  const ordered: GenericObject = {}
  for (const [key, nestedValue] of sortedEntries) {
    ordered[key] = orderObjectKeys(nestedValue, false)
  }
  return ordered
}

const normalizeForYaml = (obj: unknown): unknown => {
  if (obj == null || typeof obj !== 'object') {
    return obj
  }

  const cloned = cloneObject(obj as GenericObject)
  const kindValue = cloned.kind
  if (kindValue === 'Secret') {
    cloned.type = toComparableSecretType(cloned.type)
  }

  return orderObjectKeys(cloned, true)
}

const ensureTrailingNewline = (text: string): string => {
  if (text.length === 0) {
    return text
  }
  if (text.endsWith('\n')) {
    return text
  }
  return `${text}\n`
}

const toYaml = (obj: unknown): string => {
  if (obj == null) {
    return ''
  }
  const normalized = normalizeForYaml(obj)
  return ensureTrailingNewline(yamlStringify(normalized))
}

const getMetadataString = (
  resource: GenericObject,
  key: 'name' | 'namespace'
): string | undefined => {
  const metadata = resource.metadata
  if (metadata == null || typeof metadata !== 'object') {
    return undefined
  }
  const value = (metadata as GenericObject)[key]
  if (typeof value !== 'string') {
    return undefined
  }
  return value
}

const isResourceKind = (kind: string): kind is ResourceKind => {
  return (
    kind === 'Pod' ||
    kind === 'ConfigMap' ||
    kind === 'Secret' ||
    kind === 'Node' ||
    kind === 'ReplicaSet' ||
    kind === 'Deployment' ||
    kind === 'DaemonSet' ||
    kind === 'Service'
  )
}

const findByKindNameAndNamespace = (
  apiServer: ApiServerFacade,
  kind: ResourceKind,
  name: string,
  namespace?: string
): GenericObject | undefined => {
  const resourceResult = apiServer.findResource(kind, name, namespace)
  if (!resourceResult.ok) {
    return undefined
  }
  return resourceResult.value as unknown as GenericObject
}

const hydrateApiServerFromSnapshot = (
  apiServer: ApiServerFacade,
  snapshot: ClusterStateData
): void => {
  for (const namespace of snapshot.namespaces.items) {
    apiServer.createResource('Namespace', namespace)
  }
  for (const node of snapshot.nodes.items) {
    apiServer.createResource('Node', node)
  }
  for (const persistentVolume of snapshot.persistentVolumes.items) {
    apiServer.createResource('PersistentVolume', persistentVolume)
  }
  for (const persistentVolumeClaim of snapshot.persistentVolumeClaims.items) {
    apiServer.createResource('PersistentVolumeClaim', persistentVolumeClaim)
  }
  for (const configMap of snapshot.configMaps.items) {
    apiServer.createResource('ConfigMap', configMap)
  }
  for (const secret of snapshot.secrets.items) {
    apiServer.createResource('Secret', secret)
  }
  for (const service of snapshot.services.items) {
    apiServer.createResource('Service', service)
  }
  for (const deployment of snapshot.deployments.items) {
    apiServer.createResource('Deployment', deployment)
  }
  for (const daemonSet of snapshot.daemonSets.items) {
    apiServer.createResource('DaemonSet', daemonSet)
  }
  for (const replicaSet of snapshot.replicaSets.items) {
    apiServer.createResource('ReplicaSet', replicaSet)
  }
  for (const pod of snapshot.pods.items) {
    apiServer.createResource('Pod', pod)
  }
}

const getNestedDataMap = (
  resource: GenericObject | undefined
): Record<string, unknown> | undefined => {
  if (resource == null) {
    return undefined
  }
  const data = resource.data
  if (data == null || typeof data !== 'object') {
    return undefined
  }
  return data as Record<string, unknown>
}

const maskSecretData = (
  fromResource: GenericObject | undefined,
  toResource: GenericObject | undefined
): {
  fromMasked: GenericObject | undefined
  toMasked: GenericObject | undefined
} => {
  if (fromResource == null && toResource == null) {
    return { fromMasked: fromResource, toMasked: toResource }
  }

  const fromMasked =
    fromResource == null ? undefined : cloneObject(fromResource)
  const toMasked = toResource == null ? undefined : cloneObject(toResource)

  const fromData = getNestedDataMap(fromMasked)
  const toData = getNestedDataMap(toMasked)

  if (fromData == null && toData == null) {
    return { fromMasked, toMasked }
  }

  const keys = new Set<string>()
  if (fromData != null) {
    for (const key of Object.keys(fromData)) {
      keys.add(key)
    }
  }
  if (toData != null) {
    for (const key of Object.keys(toData)) {
      keys.add(key)
    }
  }

  for (const key of keys) {
    const hasFrom = fromData != null && key in fromData
    const hasTo = toData != null && key in toData

    if (hasFrom && hasTo && fromData != null && toData != null) {
      if (fromData[key] !== toData[key]) {
        fromData[key] = SENSITIVE_MASK_BEFORE
        toData[key] = SENSITIVE_MASK_AFTER
      } else {
        fromData[key] = SENSITIVE_MASK_DEFAULT
        toData[key] = SENSITIVE_MASK_DEFAULT
      }
      continue
    }

    if (hasFrom && fromData != null) {
      fromData[key] = SENSITIVE_MASK_DEFAULT
    }
    if (hasTo && toData != null) {
      toData[key] = SENSITIVE_MASK_DEFAULT
    }
  }

  return { fromMasked, toMasked }
}

const sanitizeBeforeDiff = (
  liveResource: GenericObject | undefined,
  mergedResource: GenericObject | undefined,
  kind: string
): {
  liveSanitized: GenericObject | undefined
  mergedSanitized: GenericObject | undefined
} => {
  if (kind === 'Secret') {
    const masked = maskSecretData(liveResource, mergedResource)
    return {
      liveSanitized: masked.fromMasked,
      mergedSanitized: masked.toMasked
    }
  }
  return {
    liveSanitized: liveResource == null ? undefined : cloneObject(liveResource),
    mergedSanitized:
      mergedResource == null ? undefined : cloneObject(mergedResource)
  }
}

const buildDiffFileName = (
  apiVersion: string,
  kind: string,
  namespace: string | undefined,
  name: string
): string => {
  const safeNamespace = namespace ?? '_cluster'
  const safeApiVersion = apiVersion.replace(/\//g, '.')
  return `${safeApiVersion}.${kind}.${safeNamespace}.${name}`
}

const hashText = (value: string): number => {
  let hash = 0
  for (let index = 0; index < value.length; index++) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash = hash & hash
  }
  return Math.abs(hash)
}

const buildDiffPath = (
  version: 'LIVE' | 'MERGED',
  fileName: string,
  seed: string
): string => {
  const hash = hashText(`${version}:${seed}`)
  return `/tmp/${version}-${hash}/${fileName}`
}

const buildResourceDiff = (
  fileName: string,
  liveYaml: string,
  mergedYaml: string,
  seed: string
): string => {
  if (liveYaml === mergedYaml) {
    return ''
  }
  const fromPath = buildDiffPath('LIVE', fileName, seed)
  const toPath = buildDiffPath('MERGED', fileName, seed)
  const prelude = `diff -u -N ${fromPath} ${toPath}\n`
  return createTwoFilesPatch(fromPath, toPath, liveYaml, mergedYaml, '', '', {
    context: 3
  })
    .split('\n')
    .filter((line) => !line.startsWith('Index: ') && !line.startsWith('='))
    .join('\n')
    .trim()
    .replace(/^--- /, '--- ')
    .replace(/^\+\+\+ /, '+++ ')
    .replace(/^@@/m, '@@')
    .replace(/\n+$/, '')
    .replace(/^/, prelude)
}

const computeMergedResource = (
  stateSnapshot: ClusterStateData,
  parsedResource: GenericObject,
  liveResource: GenericObject | undefined,
  kind: string,
  name: string,
  namespace: string | undefined
): GenericObject | undefined => {
  const dryRunApiServer = createApiServerFacade()
  hydrateApiServerFromSnapshot(dryRunApiServer, cloneObject(stateSnapshot))
  const localResource = cloneObject(parsedResource)
  const localMetadata = localResource.metadata
  const liveMetadata = liveResource?.metadata
  if (localMetadata != null && typeof localMetadata === 'object') {
    if (liveMetadata != null && typeof liveMetadata === 'object') {
      const liveCreationTimestamp = (liveMetadata as GenericObject)
        .creationTimestamp
      if (typeof liveCreationTimestamp === 'string') {
        const metadataForUpdate = localMetadata as GenericObject
        metadataForUpdate.creationTimestamp = liveCreationTimestamp
      }
    }
  }

  applyResourceWithEvents(localResource as KubernetesResource, dryRunApiServer)
  if (!isResourceKind(kind)) {
    return undefined
  }
  return findByKindNameAndNamespace(dryRunApiServer, kind, name, namespace)
}

export const handleDiff = (
  fileSystem: FileSystem,
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ExecutionResult => {
  const filename = getFilenameFromFlags(parsed)
  if (filename == null) {
    return error('error: must specify one of -f or --filename')
  }

  const fileResult = fileSystem.readFile(filename)
  if (!fileResult.ok) {
    return error(`error: ${fileResult.error}`)
  }

  const parseResult = parseKubernetesYaml(fileResult.value)
  if (!parseResult.ok) {
    return error(`error: ${parseResult.error}`)
  }

  const parsedResource = parseResult.value as unknown as GenericObject
  const apiVersion = String(
    (parsedResource as GenericObject).apiVersion ?? 'v1'
  )
  const kind = String((parsedResource as GenericObject).kind ?? '')
  const name = getMetadataString(parsedResource, 'name')
  const namespace = getMetadataString(parsedResource, 'namespace')

  if (kind.length === 0 || name == null || name.length === 0) {
    return error('error: invalid manifest metadata for diff')
  }
  if (!isResourceKind(kind)) {
    return error(`error: unsupported resource kind for diff: ${kind}`)
  }

  const snapshot = apiServer.snapshotState()
  const live = findByKindNameAndNamespace(apiServer, kind, name, namespace)
  const merged = computeMergedResource(
    snapshot,
    parsedResource,
    live,
    kind,
    name,
    namespace
  )
  const sanitized = sanitizeBeforeDiff(live, merged, kind)
  const liveYaml = toYaml(sanitized.liveSanitized)
  const mergedYaml = toYaml(sanitized.mergedSanitized)
  const diffFileName = buildDiffFileName(apiVersion, kind, namespace, name)
  const diffOutput = buildResourceDiff(
    diffFileName,
    liveYaml,
    mergedYaml,
    filename
  )
  const cleanedDiff = diffOutput.trim()
  if (cleanedDiff.length === 0) {
    return success('')
  }

  return success(cleanedDiff)
}
