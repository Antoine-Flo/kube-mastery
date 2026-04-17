import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import { RESOURCE_OUTPUT_METADATA_BY_RESOURCE } from '../commands/resourceCatalog.generated'
import type { Resource } from '../commands/types'

export type OpenAPISpecFile =
  | 'api__v1_openapi.json'
  | 'apis__apps__v1_openapi.json'
  | 'apis__coordination.k8s.io__v1_openapi.json'

export interface OpenAPIResourceTarget {
  group: string
  version: string
  kind: string
  schemaName: string
  specFile: OpenAPISpecFile
}

type BaseTarget = {
  group: string
  version: string
  kind: string
}

const parseApiVersion = (
  apiVersion: string
): Result<{ group: string; version: string }> => {
  if (apiVersion === 'v1') {
    return success({ group: '', version: 'v1' })
  }

  const chunks = apiVersion.split('/')
  if (chunks.length !== 2) {
    return error(`invalid api version "${apiVersion}"`)
  }

  const [group, version] = chunks
  if (!group || !version) {
    return error(`invalid api version "${apiVersion}"`)
  }
  return success({ group, version })
}

const buildBaseResourceTargets = (): Record<Resource, BaseTarget | undefined> => {
  const map = { all: undefined } as Record<Resource, BaseTarget | undefined>
  for (const [resource, metadata] of Object.entries(
    RESOURCE_OUTPUT_METADATA_BY_RESOURCE
  ) as Array<
    [Exclude<Resource, 'all'>, { apiVersion: string; kind: string }]
  >) {
    const parsedApiVersion = parseApiVersion(metadata.apiVersion)
    if (!parsedApiVersion.ok) {
      map[resource] = undefined
      continue
    }
    map[resource] = {
      group: parsedApiVersion.value.group,
      version: parsedApiVersion.value.version,
      kind: metadata.kind
    }
  }
  return map
}

const BASE_RESOURCE_TARGETS = buildBaseResourceTargets()

const buildSchemaName = (
  group: string,
  version: string,
  kind: string
): string => {
  if (group.length === 0 && version === 'v1') {
    return `io.k8s.api.core.v1.${kind}`
  }
  if (group === 'coordination.k8s.io' && version === 'v1') {
    return `io.k8s.api.coordination.v1.${kind}`
  }
  return `io.k8s.api.${group}.${version}.${kind}`
}

const resolveSpecFile = (
  group: string,
  version: string
): Result<OpenAPISpecFile> => {
  if (group.length === 0 && version === 'v1') {
    return success('api__v1_openapi.json')
  }
  if (group === 'apps' && version === 'v1') {
    return success('apis__apps__v1_openapi.json')
  }
  if (group === 'coordination.k8s.io' && version === 'v1') {
    return success('apis__coordination.k8s.io__v1_openapi.json')
  }
  return error(
    `api-version ${group}/${version} is not supported in this simulator`
  )
}

export const mapResourceToOpenAPITarget = (
  resource: Resource,
  apiVersion?: string
): Result<OpenAPIResourceTarget> => {
  const baseTarget = BASE_RESOURCE_TARGETS[resource]
  if (!baseTarget) {
    return error(
      `error: the server does not have a resource type "${resource}"`
    )
  }

  let group = baseTarget.group
  let version = baseTarget.version
  if (typeof apiVersion === 'string' && apiVersion.length > 0) {
    const parsedApiVersion = parseApiVersion(apiVersion)
    if (!parsedApiVersion.ok) {
      return parsedApiVersion
    }
    group = parsedApiVersion.value.group
    version = parsedApiVersion.value.version
  }

  const specFile = resolveSpecFile(group, version)
  if (!specFile.ok) {
    return specFile
  }

  return success({
    group,
    version,
    kind: baseTarget.kind,
    schemaName: buildSchemaName(group, version, baseTarget.kind),
    specFile: specFile.value
  })
}
