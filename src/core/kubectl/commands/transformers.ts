import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import type { Action, Resource } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL COMMAND TRANSFORMERS
// ═══════════════════════════════════════════════════════════════════════════
// Action-specific transformers for kubectl command parsing
// Each action can have custom logic to extract specific fields from tokens

// ─── Types ───────────────────────────────────────────────────────────────

/**
 * Internal parsing context that accumulates state through the pipeline
 */
export type ParseContext = {
  input: string
  tokens?: string[]
  action?: Action
  resource?: Resource
  name?: string
  flags?: Record<string, string | boolean>
  normalizedFlags?: Record<string, string | boolean>
  execCommand?: string[]
  createImages?: string[]
  createCommand?: string[]
  labelChanges?: Record<string, string | null>
  annotationChanges?: Record<string, string | null>
}

type ActionTransformer = (ctx: ParseContext) => Result<ParseContext>

// ─── Resource Alias Mapping ──────────────────────────────────────────────

// Kubectl resources: canonical name -> list of aliases
const KUBECTL_RESOURCES = {
  pods: ['pods', 'pod', 'po'],
  deployments: ['deployments', 'deployment', 'deploy'],
  services: ['services', 'service', 'svc'],
  namespaces: ['namespaces', 'namespace', 'ns'],
  configmaps: ['configmaps', 'configmap', 'cm'],
  secrets: ['secrets', 'secret'],
  replicasets: ['replicasets', 'replicaset', 'rs']
} as const

// Build reverse lookup: alias -> canonical resource (O(1) access)
const buildResourceAliasMap = (): Record<string, string> => {
  const map: Record<string, string> = {}
  for (const [canonical, aliases] of Object.entries(KUBECTL_RESOURCES)) {
    for (const alias of aliases) {
      map[alias] = canonical
    }
  }
  return map
}

const RESOURCE_ALIAS_MAP = buildResourceAliasMap()

const FLAGS_REQUIRING_VALUES = new Set([
  'n',
  'namespace',
  'f',
  'filename',
  'image',
  'replicas',
  'port'
])

// ─── Helper Functions ────────────────────────────────────────────────────

/**
 * Find name token skipping flags
 */
const findNameSkippingFlags = (
  tokens: string[],
  startIndex: number
): string | undefined => {
  for (let i = startIndex; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === '--') {
      break
    }

    if (token.startsWith('-')) {
      const flagName = token.replace(/^-+/, '').split('=')[0]
      if (FLAGS_REQUIRING_VALUES.has(flagName) && !token.includes('=')) {
        i += 1
      }
      continue
    }

    return token
  }
  return undefined
}

const splitTokensBySeparator = (
  tokens: string[]
): { beforeSeparator: string[]; afterSeparator?: string[] } => {
  const separatorIndex = tokens.indexOf('--')
  if (separatorIndex === -1) {
    return { beforeSeparator: tokens }
  }

  const beforeSeparator = tokens.slice(0, separatorIndex)
  const afterSeparator = tokens.slice(separatorIndex + 1)
  return { beforeSeparator, afterSeparator }
}

const extractFlagValues = (tokens: string[], flagName: string): string[] => {
  const values: string[] = []

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]
    const prefix = `--${flagName}=`
    if (token.startsWith(prefix)) {
      const value = token.slice(prefix.length)
      if (value) {
        values.push(value)
      }
      continue
    }

    if (token !== `--${flagName}`) {
      continue
    }

    const nextToken = tokens[i + 1]
    if (!nextToken || nextToken.startsWith('-')) {
      continue
    }

    values.push(nextToken)
    i += 1
  }

  return values
}

/**
 * Parse key-value changes from tokens (for label/annotate)
 * Supports: key=value (add/update) and key- (remove)
 */
const parseChanges = (tokens: string[]): Record<string, string | null> => {
  const changes: Record<string, string | null> = {}

  for (const token of tokens) {
    // Skip flags
    if (token.startsWith('-')) {
      continue
    }

    // Check for removal syntax: key-
    if (token.endsWith('-') && !token.includes('=')) {
      const key = token.slice(0, -1)
      if (key) {
        changes[key] = null
      }
      continue
    }

    // Check for key=value syntax
    if (token.includes('=')) {
      const [key, ...valueParts] = token.split('=')
      const value = valueParts.join('=') // Handle values with = in them
      if (key && value !== undefined) {
        changes[key] = value
      }
    }
  }

  return changes
}

// ─── Transformers ────────────────────────────────────────────────────────

/**
 * Transformer for exec command: sets resource and extracts command after -- separator
 */
const execTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens) {
    return success(ctx)
  }

  // Set resource to pods (exec always targets pods)
  const updatedCtx = { ...ctx, resource: 'pods' as Resource }

  // Find the -- separator
  const separatorIndex = ctx.tokens.indexOf('--')
  if (separatorIndex === -1) {
    return success(updatedCtx)
  }

  // Everything after -- is the exec command
  const execCommand = ctx.tokens.slice(separatorIndex + 1)

  // Remove exec command from tokens so flag parsing doesn't see it
  const newTokens = ctx.tokens.slice(0, separatorIndex)

  return success({ ...updatedCtx, tokens: newTokens, execCommand })
}

/**
 * Transformer for apply: sets default resource to pods
 */
const applyTransformer: ActionTransformer = (ctx) => {
  return success({ ...ctx, resource: 'pods' as Resource })
}

/**
 * Transformer for create:
 * - create -f file.yaml (legacy path)
 * - create deployment <name> --image=... [-- ...]
 */
const createTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens) {
    return success(ctx)
  }

  const { beforeSeparator, afterSeparator } = splitTokensBySeparator(ctx.tokens)
  const createCommand =
    afterSeparator && afterSeparator.length > 0 ? afterSeparator : undefined
  const resourceToken = beforeSeparator[2]

  if (!resourceToken || resourceToken.startsWith('-')) {
    return success({
      ...ctx,
      resource: 'pods' as Resource,
      tokens: beforeSeparator,
      createCommand
    })
  }

  const resource = RESOURCE_ALIAS_MAP[resourceToken] as Resource | undefined
  if (!resource) {
    return success({
      ...ctx,
      tokens: beforeSeparator,
      createCommand
    })
  }

  const name = findNameSkippingFlags(beforeSeparator, 3)
  const createImages = extractFlagValues(beforeSeparator, 'image')
  const hasCreateImages = createImages.length > 0

  return success({
    ...ctx,
    resource,
    name,
    tokens: beforeSeparator,
    createImages: hasCreateImages ? createImages : undefined,
    createCommand
  })
}

/**
 * Transformer for logs: sets resource to pods
 */
const logsTransformer: ActionTransformer = (ctx) => {
  return success({ ...ctx, resource: 'pods' as Resource })
}

/**
 * Transformer for label command: sets resource, extracts name and label changes
 */
const labelTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens) {
    return success(ctx)
  }

  // Extract resource from position 2
  const resourceToken = ctx.tokens[2]
  if (!resourceToken || resourceToken.startsWith('-')) {
    return error('Invalid or missing resource type')
  }

  // Map resource alias to canonical
  const resource = RESOURCE_ALIAS_MAP[resourceToken] as Resource | undefined
  if (!resource) {
    return error('Invalid or missing resource type')
  }

  // Extract name from position 3 (skip flags)
  const name = findNameSkippingFlags(ctx.tokens, 3)

  // Parse label changes from tokens after name
  // Skip: kubectl (0), label (1), resource (2), name (3)
  const changesTokens = ctx.tokens.slice(4)
  const labelChanges = parseChanges(changesTokens)

  return success({ ...ctx, resource, name, labelChanges })
}

/**
 * Transformer for annotate command: sets resource, extracts name and annotation changes
 */
const annotateTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens) {
    return success(ctx)
  }

  // Extract resource from position 2
  const resourceToken = ctx.tokens[2]
  if (!resourceToken || resourceToken.startsWith('-')) {
    return error('Invalid or missing resource type')
  }

  // Map resource alias to canonical
  const resource = RESOURCE_ALIAS_MAP[resourceToken] as Resource | undefined
  if (!resource) {
    return error('Invalid or missing resource type')
  }

  // Extract name from position 3 (skip flags)
  const name = findNameSkippingFlags(ctx.tokens, 3)

  // Parse annotation changes from tokens after name
  // Skip: kubectl (0), annotate (1), resource (2), name (3)
  const changesTokens = ctx.tokens.slice(4)
  const annotationChanges = parseChanges(changesTokens)

  return success({ ...ctx, resource, name, annotationChanges })
}

/**
 * Transformer for version command: explicitly sets resource to undefined
 * Version command doesn't require a resource
 */
const versionTransformer: ActionTransformer = (ctx) => {
  return success({ ...ctx, resource: undefined })
}

/**
 * Transformer for cluster-info command: explicitly sets resource to undefined
 * Cluster-info command doesn't require a resource
 * Detects subcommand "dump" and sets it as a flag
 */
const clusterInfoTransformer: ActionTransformer = (ctx) => {
  // Check if next token after "cluster-info" is "dump"
  if (ctx.tokens && ctx.tokens.length >= 3 && ctx.tokens[2] === 'dump') {
    // Set dump flag and remove "dump" token from tokens
    const newTokens = ctx.tokens.filter((_, idx) => idx !== 2)
    const flags = { ...ctx.flags, dump: true }
    return success({ ...ctx, resource: undefined, tokens: newTokens, flags })
  }
  return success({ ...ctx, resource: undefined })
}

/**
 * Transformer for api-resources command: explicitly sets resource to undefined
 * Api-resources command doesn't require a resource
 */
const apiResourcesTransformer: ActionTransformer = (ctx) => {
  return success({ ...ctx, resource: undefined })
}

/**
 * Transformer for scale command: extracts resource and name
 * Supports two syntaxes:
 * - kubectl scale deployment/name --replicas=N
 * - kubectl scale deployment name --replicas=N
 */
const scaleTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens) {
    return success(ctx)
  }

  // Find first non-flag token after "scale" (position 2+)
  let resourceToken: string | undefined
  let nameToken: string | undefined

  for (let i = 2; i < ctx.tokens.length; i++) {
    const token = ctx.tokens[i]
    if (token.startsWith('-')) {
      // Skip flag and its value
      if (token.includes('=')) continue
      // Standalone flag, skip next token as value
      i++
      continue
    }

    if (!resourceToken) {
      resourceToken = token
    } else if (!nameToken) {
      nameToken = token
      break
    }
  }

  if (!resourceToken) {
    return error('Invalid or missing resource type')
  }

  // Check for type/name syntax (e.g., deployment/nginx)
  if (resourceToken.includes('/')) {
    const [resourcePart, namePart] = resourceToken.split('/')
    const resource = RESOURCE_ALIAS_MAP[resourcePart] as Resource | undefined
    if (!resource) {
      return error('Invalid or missing resource type')
    }
    return success({ ...ctx, resource, name: namePart })
  }

  // Standard syntax: resource name
  const resource = RESOURCE_ALIAS_MAP[resourceToken] as Resource | undefined
  if (!resource) {
    return error('Invalid or missing resource type')
  }

  return success({ ...ctx, resource, name: nameToken })
}

/**
 * Default transformer: no-op, returns context as-is
 */
const identityTransformer: ActionTransformer = (ctx) => success(ctx)

/**
 * Map of action-specific transformers
 * Add new actions here without modifying the pipeline
 */
const ACTIONS_WITH_CUSTOM_PARSING: Record<string, ActionTransformer> = {
  exec: execTransformer,
  logs: logsTransformer,
  apply: applyTransformer,
  create: createTransformer,
  label: labelTransformer,
  annotate: annotateTransformer,
  version: versionTransformer,
  'cluster-info': clusterInfoTransformer,
  'api-resources': apiResourcesTransformer,
  scale: scaleTransformer
}

/**
 * Get transformer for an action (returns identity if none exists)
 */
export const getTransformerForAction = (action?: Action): ActionTransformer => {
  if (!action) {
    return identityTransformer
  }
  return ACTIONS_WITH_CUSTOM_PARSING[action] || identityTransformer
}
