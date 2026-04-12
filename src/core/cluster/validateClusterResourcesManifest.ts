import type { OpenAPISpec } from '../openapi/loader'
import {
  BUNDLED_OPENAPI_SPECS,
  BUNDLED_OPENAPI_SPEC_FILES
} from '../openapi/bundledOpenAPISpecs'
import { getOpenAPISchemaName } from '../openapi/schemaName'

export type ClusterResourceFacade =
  | 'standardNamespaced'
  | 'clusterScopedEmptyNs'
  | 'node'
  | 'namespaceResource'

export type ClusterResourceBootstrapEmpty = 'default' | 'systemNamespaces'

export interface ClusterResourceManifestEntry {
  kind: string
  apiVersion: string
  collectionKey: string
  typeName: string
  importPath: string
  repoKindArg: string
  facade: ClusterResourceFacade
  bootstrapEmpty: ClusterResourceBootstrapEmpty
  facadeSingular: string
  facadePlural: string
  /** Default bundled validation, or external CRD schemas not in Kubernetes core bundle. */
  openapiSource?: 'bundled' | 'external-crd'
  kubectlShortAliases?: string[]
  kubectlSingularAlias?: string
  kubectlDeleteSupported?: boolean
  kubectlYamlSupported?: boolean
  kubectlGetSupported?: boolean
  kubectlKindRef?: string
  kubectlKindRefPlural?: string
}

export interface KubectlExtraResourceManifestEntry {
  canonical: string
  aliases: string[]
  /** Required for every extra except canonical `all` (drives output metadata and discovery refs). */
  outputApiVersion?: string
  outputKind?: string
}

export interface ClusterResourcesManifest {
  resources: ClusterResourceManifestEntry[]
  kubectlExtraResources?: KubectlExtraResourceManifestEntry[]
}

/**
 * Builds kubectl alias lists for a manifest entry (deduped, order preserved).
 */
export const buildKubectlAliasesForManifestEntry = (
  entry: ClusterResourceManifestEntry
): string[] => {
  const canonicalKey = entry.collectionKey.toLowerCase()
  const pluralWord = entry.facadePlural.toLowerCase()
  const singularWord = entry.kubectlSingularAlias ?? entry.kind.toLowerCase()
  const shorts = entry.kubectlShortAliases ?? []
  const list = [canonicalKey, pluralWord, singularWord, ...shorts]
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of list) {
    if (seen.has(p)) {
      continue
    }
    seen.add(p)
    out.push(p)
  }
  return out
}

const FACADES: ClusterResourceFacade[] = [
  'standardNamespaced',
  'clusterScopedEmptyNs',
  'node',
  'namespaceResource'
]

const parseExpectedGvk = (
  apiVersion: string,
  kind: string
): { group: string; version: string; kind: string } => {
  if (apiVersion === 'v1') {
    return { group: '', version: 'v1', kind }
  }
  const slash = apiVersion.indexOf('/')
  if (slash === -1) {
    return { group: '', version: apiVersion, kind }
  }
  const group = apiVersion.slice(0, slash)
  const version = apiVersion.slice(slash + 1)
  return { group, version, kind }
}

const schemaMatchesManifestGvk = (
  schema: Record<string, unknown>,
  expected: { group: string; version: string; kind: string }
): boolean => {
  const raw = schema['x-kubernetes-group-version-kind']
  if (!Array.isArray(raw) || raw.length === 0) {
    return true
  }
  const first = raw[0] as Record<string, unknown>
  const g = typeof first.group === 'string' ? first.group : ''
  const v = typeof first.version === 'string' ? first.version : ''
  const k = typeof first.kind === 'string' ? first.kind : ''
  if (k !== expected.kind) {
    return false
  }
  if (g !== expected.group) {
    return false
  }
  if (v !== expected.version) {
    return false
  }
  return true
}

const findSchemaInBundle = (
  schemaName: string
): { specIndex: number; schema: Record<string, unknown> } | null => {
  for (let i = 0; i < BUNDLED_OPENAPI_SPECS.length; i++) {
    const spec = BUNDLED_OPENAPI_SPECS[i]
    const schema = spec.components.schemas[schemaName] as
      | Record<string, unknown>
      | undefined
    if (schema) {
      return { specIndex: i, schema }
    }
  }
  return null
}

export const validateClusterResourcesManifest = (
  manifest: ClusterResourcesManifest
): { ok: true } | { ok: false; errors: string[] } => {
  const errors: string[] = []
  if (!manifest.resources || !Array.isArray(manifest.resources)) {
    return {
      ok: false,
      errors: ['manifest.resources must be a non-empty array']
    }
  }
  if (manifest.resources.length === 0) {
    return { ok: false, errors: ['manifest.resources is empty'] }
  }

  const kinds = new Set<string>()
  const collectionKeys = new Set<string>()
  let systemNsCount = 0

  for (let i = 0; i < manifest.resources.length; i++) {
    const r = manifest.resources[i]
    const prefix = `resources[${i}] (${r?.kind ?? '?'})`
    if (!r || typeof r !== 'object') {
      errors.push(`${prefix}: invalid entry`)
      continue
    }
    if (!r.kind || typeof r.kind !== 'string') {
      errors.push(`${prefix}: missing kind`)
    }
    if (!r.apiVersion || typeof r.apiVersion !== 'string') {
      errors.push(`${prefix}: missing apiVersion`)
    }
    if (!r.collectionKey || typeof r.collectionKey !== 'string') {
      errors.push(`${prefix}: missing collectionKey`)
    }
    if (!r.typeName || typeof r.typeName !== 'string') {
      errors.push(`${prefix}: missing typeName`)
    }
    if (!r.importPath || typeof r.importPath !== 'string') {
      errors.push(`${prefix}: missing importPath`)
    }
    if (!r.repoKindArg || typeof r.repoKindArg !== 'string') {
      errors.push(`${prefix}: missing repoKindArg`)
    }
    if (!FACADES.includes(r.facade)) {
      errors.push(`${prefix}: invalid facade "${r.facade}"`)
    }
    if (
      r.bootstrapEmpty !== 'default' &&
      r.bootstrapEmpty !== 'systemNamespaces'
    ) {
      errors.push(`${prefix}: invalid bootstrapEmpty`)
    }
    if (!r.facadeSingular || !r.facadePlural) {
      errors.push(`${prefix}: missing facadeSingular or facadePlural`)
    }
    if (r.openapiSource !== undefined) {
      if (r.openapiSource !== 'bundled' && r.openapiSource !== 'external-crd') {
        errors.push(`${prefix}: invalid openapiSource "${r.openapiSource}"`)
      }
    }
    if (r.kind && kinds.has(r.kind)) {
      errors.push(`duplicate kind: ${r.kind}`)
    }
    if (r.kind) {
      kinds.add(r.kind)
    }
    if (r.collectionKey && collectionKeys.has(r.collectionKey)) {
      errors.push(`duplicate collectionKey: ${r.collectionKey}`)
    }
    if (r.collectionKey) {
      collectionKeys.add(r.collectionKey)
    }
    if (r.bootstrapEmpty === 'systemNamespaces') {
      systemNsCount++
    }

    if (r.kubectlShortAliases !== undefined) {
      if (!Array.isArray(r.kubectlShortAliases)) {
        errors.push(`${prefix}: kubectlShortAliases must be an array`)
      } else {
        for (let j = 0; j < r.kubectlShortAliases.length; j++) {
          const s = r.kubectlShortAliases[j]
          if (typeof s !== 'string' || s.length === 0) {
            errors.push(
              `${prefix}: kubectlShortAliases[${j}] must be a non-empty string`
            )
          }
        }
      }
    }
    if (r.kubectlSingularAlias !== undefined) {
      if (
        typeof r.kubectlSingularAlias !== 'string' ||
        r.kubectlSingularAlias.length === 0
      ) {
        errors.push(
          `${prefix}: kubectlSingularAlias must be a non-empty string`
        )
      }
    }
    if (r.kubectlDeleteSupported !== undefined) {
      if (typeof r.kubectlDeleteSupported !== 'boolean') {
        errors.push(`${prefix}: kubectlDeleteSupported must be a boolean`)
      }
    }
    if (r.kubectlYamlSupported !== undefined) {
      if (typeof r.kubectlYamlSupported !== 'boolean') {
        errors.push(`${prefix}: kubectlYamlSupported must be a boolean`)
      }
    }
    if (r.kubectlGetSupported !== undefined) {
      if (typeof r.kubectlGetSupported !== 'boolean') {
        errors.push(`${prefix}: kubectlGetSupported must be a boolean`)
      }
    }
    if (r.kubectlKindRef !== undefined) {
      if (
        typeof r.kubectlKindRef !== 'string' ||
        r.kubectlKindRef.length === 0
      ) {
        errors.push(`${prefix}: kubectlKindRef must be a non-empty string`)
      }
    }
    if (r.kubectlKindRefPlural !== undefined) {
      if (
        typeof r.kubectlKindRefPlural !== 'string' ||
        r.kubectlKindRefPlural.length === 0
      ) {
        errors.push(
          `${prefix}: kubectlKindRefPlural must be a non-empty string`
        )
      }
    }

    if (!r.apiVersion || !r.kind) {
      continue
    }
    const shouldValidateBundledOpenAPI =
      r.openapiSource === undefined || r.openapiSource === 'bundled'
    if (!shouldValidateBundledOpenAPI) {
      continue
    }
    const schemaName = getOpenAPISchemaName(r.apiVersion, r.kind)
    const found = findSchemaInBundle(schemaName)
    if (!found) {
      errors.push(
        `${prefix}: OpenAPI schema not found in bundled specs: ${schemaName} (files: ${BUNDLED_OPENAPI_SPEC_FILES.join(', ')})`
      )
    } else {
      const expected = parseExpectedGvk(r.apiVersion, r.kind)
      if (!schemaMatchesManifestGvk(found.schema, expected)) {
        errors.push(
          `${prefix}: x-kubernetes-group-version-kind does not match apiVersion/kind (expected group="${expected.group}" version="${expected.version}" kind="${expected.kind}")`
        )
      }
    }
  }

  if (systemNsCount !== 1) {
    errors.push(
      `expected exactly one resource with bootstrapEmpty: systemNamespaces, found ${systemNsCount}`
    )
  }

  const clusterCanonicalKeys = new Set(
    manifest.resources.map((r) => r.collectionKey.toLowerCase())
  )
  const extrasRaw = manifest.kubectlExtraResources
  let extrasList: KubectlExtraResourceManifestEntry[] = []
  if (extrasRaw !== undefined) {
    if (!Array.isArray(extrasRaw)) {
      errors.push('kubectlExtraResources must be an array')
    } else {
      extrasList = extrasRaw
      const seenExtraCanonical = new Set<string>()
      for (let i = 0; i < extrasList.length; i++) {
        const e = extrasList[i]
        const p = `kubectlExtraResources[${i}]`
        if (!e || typeof e !== 'object') {
          errors.push(`${p}: invalid entry`)
          continue
        }
        if (typeof e.canonical !== 'string' || e.canonical.length === 0) {
          errors.push(`${p}: canonical must be a non-empty string`)
          continue
        }
        if (!Array.isArray(e.aliases) || e.aliases.length === 0) {
          errors.push(`${p}: aliases must be a non-empty array`)
          continue
        }
        if (clusterCanonicalKeys.has(e.canonical)) {
          errors.push(
            `${p}: canonical "${e.canonical}" duplicates a cluster resource key`
          )
        }
        if (seenExtraCanonical.has(e.canonical)) {
          errors.push(`${p}: duplicate extra canonical "${e.canonical}"`)
        }
        seenExtraCanonical.add(e.canonical)
        for (let j = 0; j < e.aliases.length; j++) {
          const a = e.aliases[j]
          if (typeof a !== 'string' || a.length === 0) {
            errors.push(`${p}: aliases[${j}] must be a non-empty string`)
          }
        }
        if (e.canonical === 'all') {
          if (e.outputApiVersion !== undefined || e.outputKind !== undefined) {
            errors.push(
              `${p}: outputApiVersion and outputKind must not be set for canonical "all"`
            )
          }
        } else {
          if (
            typeof e.outputApiVersion !== 'string' ||
            e.outputApiVersion.length === 0
          ) {
            errors.push(`${p}: outputApiVersion is required for non-all extras`)
          }
          if (typeof e.outputKind !== 'string' || e.outputKind.length === 0) {
            errors.push(`${p}: outputKind is required for non-all extras`)
          }
        }
      }
    }
  }

  const aliasOwner = new Map<string, string>()
  const registerKubectlAlias = (canonical: string, alias: string): void => {
    const prev = aliasOwner.get(alias)
    if (prev !== undefined && prev !== canonical) {
      errors.push(
        `kubectl alias "${alias}" maps to "${prev}" and "${canonical}"`
      )
      return
    }
    aliasOwner.set(alias, canonical)
  }
  for (const r of manifest.resources) {
    const canonical = r.collectionKey.toLowerCase()
    for (const a of buildKubectlAliasesForManifestEntry(r)) {
      registerKubectlAlias(canonical, a)
    }
  }
  for (const e of extrasList) {
    if (!e?.canonical || !Array.isArray(e.aliases)) {
      continue
    }
    for (const a of e.aliases) {
      if (typeof a === 'string' && a.length > 0) {
        registerKubectlAlias(e.canonical, a)
      }
    }
  }

  if (errors.length > 0) {
    return { ok: false, errors }
  }
  return { ok: true }
}

/** For tests or tooling that load specs from elsewhere */
export const validateManifestEntryAgainstSpecs = (
  entry: ClusterResourceManifestEntry,
  specs: OpenAPISpec[]
): { ok: true } | { ok: false; error: string } => {
  const schemaName = getOpenAPISchemaName(entry.apiVersion, entry.kind)
  for (const spec of specs) {
    const schema = spec.components.schemas[schemaName] as
      | Record<string, unknown>
      | undefined
    if (schema) {
      const expected = parseExpectedGvk(entry.apiVersion, entry.kind)
      if (!schemaMatchesManifestGvk(schema, expected)) {
        return {
          ok: false,
          error: `GVK mismatch for ${schemaName}`
        }
      }
      return { ok: true }
    }
  }
  return {
    ok: false,
    error: `Schema not found: ${schemaName}`
  }
}
