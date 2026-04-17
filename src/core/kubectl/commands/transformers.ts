import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import { parseSelector, stripMatchingQuotes } from '../../shared/parsing'
import { RESOURCE_ALIAS_MAP } from './resourceCatalog'
import { parseResourceTargetToken } from './resourceCatalog'
import {
  AUTH_SUBCOMMAND_SPECS,
  CONFIG_SUBCOMMAND_SPECS
} from './subcommandSpecs'
import {
  CREATE_IMPERATIVE_PLURAL_TOKENS,
  CREATE_SECRET_SUBCOMMAND_SPECS,
  CREATE_SERVICE_SUBCOMMAND_SPECS
} from './createImperativeSpecs'
import type { Action, Resource } from './types'
import { kubectlUnexpectedArgsUsageError } from './usageError'
import { find } from 'remeda'

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
  resourceList?: Resource[]
  resourceTokenIndex?: number
  name?: string
  flags?: Record<string, string | boolean>
  normalizedFlags?: Record<string, string | boolean>
  execCommand?: string[]
  createImages?: string[]
  createCommand?: string[]
  createServiceType?: 'clusterip' | 'nodeport' | 'loadbalancer' | 'externalname'
  createIngressClassName?: string
  createIngressRules?: string[]
  createSecretType?: 'generic' | 'tls' | 'docker-registry'
  createFromLiterals?: string[]
  createFromFiles?: string[]
  createFromEnvFiles?: string[]
  authVerb?: string
  authResource?: string
  authSubject?: string
  runImage?: string
  runCommand?: string[]
  runArgs?: string[]
  runUseCommand?: boolean
  runHasSeparator?: boolean
  runEnv?: string[]
  runLabels?: Record<string, string>
  runDryRunClient?: boolean
  runRestart?: 'Always' | 'OnFailure' | 'Never'
  runStdin?: boolean
  runTty?: boolean
  runRemove?: boolean
  setSubcommand?: 'image'
  setImageAssignments?: Record<string, string>
  configSubcommand?:
    | 'get-contexts'
    | 'current-context'
    | 'view'
    | 'set-context'
    | 'use-context'
    | 'get-clusters'
    | 'get-users'
    | 'set-credentials'
    | 'set-cluster'
    | 'unset'
    | 'rename-context'
  rolloutSubcommand?: 'status' | 'history' | 'restart' | 'undo'
  topSubcommand?: 'pods' | 'nodes'
  rolloutRevision?: number
  rolloutTimeoutSeconds?: number
  rolloutWatch?: boolean
  configCurrent?: boolean
  configMinify?: boolean
  configNamespace?: string
  configContextName?: string
  configRenameContextTo?: string
  configPath?: string
  configUserName?: string
  configClusterName?: string
  configServer?: string
  configToken?: string
  explainPath?: string[]
  labelChanges?: Record<string, string | null>
  annotationChanges?: Record<string, string | null>
  waitForCondition?: string
  waitTimeoutSeconds?: number
}

type ActionTransformer = (ctx: ParseContext) => Result<ParseContext>

const FLAGS_REQUIRING_VALUES = new Set([
  'n',
  'namespace',
  'f',
  'filename',
  'image',
  'replicas',
  'port',
  'api-version',
  'dry-run',
  'env',
  'labels',
  'selector',
  'restart',
  'output',
  'o',
  'target-port',
  'type',
  'name',
  'node-port',
  'tcp',
  'external-name',
  'from-literal',
  'from-file',
  'from-env-file',
  'cert',
  'key',
  'docker-server',
  'docker-username',
  'docker-password',
  'docker-email',
  'class',
  'rule',
  'for',
  'timeout',
  'revision',
  'p',
  'patch',
  'grace-period',
  'role',
  'clusterrole',
  'serviceaccount',
  'as',
  'token',
  'server'
])

const CREATE_SERVICE_TYPES: Set<string> = new Set(
  CREATE_SERVICE_SUBCOMMAND_SPECS.map((spec) => {
    return spec.token
  })
)

const CREATE_SECRET_TYPES: Set<string> = new Set(
  CREATE_SECRET_SUBCOMMAND_SPECS.map((spec) => {
    return spec.token
  })
)
const CREATE_IMPERATIVE_PLURAL_TOKEN_SET = new Set(
  CREATE_IMPERATIVE_PLURAL_TOKENS
)

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

const hasFilenameFlagInTokens = (
  tokens: string[],
  startIndex: number
): boolean => {
  for (let index = startIndex; index < tokens.length; index++) {
    const token = tokens[index]
    if (token === '-f' || token.startsWith('-f=')) {
      return true
    }
    if (token === '--filename' || token.startsWith('--filename=')) {
      return true
    }
  }
  return false
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

const extractPositionalTokensAfterAction = (tokens: string[]): string[] => {
  return extractPositionalTokensFromIndex(tokens, 2)
}

const extractPositionalTokensFromIndex = (
  tokens: string[],
  startIndex: number
): string[] => {
  const positionalTokens: string[] = []

  for (let index = startIndex; index < tokens.length; index++) {
    const token = tokens[index]
    if (token === '--') {
      break
    }
    if (token.startsWith('-')) {
      const flagName = token.replace(/^-+/, '').split('=')[0]
      const hasInlineValue = token.includes('=')
      if (FLAGS_REQUIRING_VALUES.has(flagName) && !hasInlineValue) {
        index += 1
      }
      continue
    }
    positionalTokens.push(token)
  }

  return positionalTokens
}

const resolveResourceFromToken = (
  resourceToken: string
): Result<Resource> => {
  const resource = RESOURCE_ALIAS_MAP[resourceToken] as Resource | undefined
  if (!resource) {
    return error('Invalid or missing resource type')
  }
  return success(resource)
}

const resolveResourceAndNameFromTargetToken = (
  targetToken: string,
  fallbackName?: string
): Result<{ resource: Resource; name: string | undefined }> => {
  if (targetToken.includes('/')) {
    const [resourceToken, nameToken] = targetToken.split('/', 2)
    const resourceResult = resolveResourceFromToken(resourceToken)
    if (!resourceResult.ok) {
      return resourceResult
    }
    return success({
      resource: resourceResult.value,
      name: nameToken
    })
  }
  const resourceResult = resolveResourceFromToken(targetToken)
  if (!resourceResult.ok) {
    return resourceResult
  }
  return success({
    resource: resourceResult.value,
    name: fallbackName
  })
}

const splitExplainPath = (
  explainArg: string
): { resourceToken: string; explainPath: string[] } | null => {
  const normalized = explainArg.trim().replace(/\.$/, '')
  if (!normalized) {
    return null
  }

  const segments = normalized.split('.')
  if (segments.some((segment) => segment.length === 0)) {
    return null
  }

  const [resourceToken, ...explainPath] = segments
  if (!resourceToken) {
    return null
  }

  return { resourceToken, explainPath }
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
      const key = stripMatchingQuotes(token.slice(0, -1))
      if (key) {
        changes[key] = null
      }
      continue
    }

    // Check for key=value syntax
    if (token.includes('=')) {
      const [key, ...valueParts] = token.split('=')
      const normalizedKey = stripMatchingQuotes(key)
      const value = stripMatchingQuotes(valueParts.join('=')) // Handle values with = in them
      if (normalizedKey && value !== undefined) {
        changes[normalizedKey] = value
      }
    }
  }

  return changes
}

const parseRunLabels = (
  labelsValues: string[]
): Record<string, string> | undefined => {
  if (labelsValues.length === 0) {
    return undefined
  }

  const parsed: Record<string, string> = {}
  for (const labelsValue of labelsValues) {
    const fromSelector = parseSelector(labelsValue)
    for (const [key, value] of Object.entries(fromSelector)) {
      parsed[key] = value
    }
  }

  if (Object.keys(parsed).length === 0) {
    return undefined
  }

  return parsed
}

const hasShortFlag = (tokens: string[], shortFlag: string): boolean => {
  for (const token of tokens) {
    if (token === `-${shortFlag}`) {
      return true
    }
    const isBundledShortFlag =
      token.startsWith('-') &&
      !token.startsWith('--') &&
      token.length > 2 &&
      !token.includes('=')
    if (!isBundledShortFlag) {
      continue
    }
    if (token.slice(1).includes(shortFlag)) {
      return true
    }
  }
  return false
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
  if (!ctx.tokens) {
    return success({ ...ctx, resource: 'pods' as Resource })
  }

  const applyPositionalTokens = extractPositionalTokensAfterAction(ctx.tokens)
  if (applyPositionalTokens.length > 0) {
    return error(
      kubectlUnexpectedArgsUsageError('kubectl apply', applyPositionalTokens)
    )
  }

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
  const positionalTokens = extractPositionalTokensAfterAction(beforeSeparator)
  const firstPositional = positionalTokens[0]
  if (
    firstPositional != null &&
    CREATE_IMPERATIVE_PLURAL_TOKEN_SET.has(firstPositional)
  ) {
    return error(
      kubectlUnexpectedArgsUsageError('kubectl create', positionalTokens)
    )
  }
  const resourceToken = beforeSeparator[2]
  if (resourceToken === 'token') {
    const serviceAccountName = findNameSkippingFlags(beforeSeparator, 3)
    return success({
      ...ctx,
      action: 'create-token',
      resource: undefined,
      name: serviceAccountName,
      tokens: beforeSeparator
    })
  }

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
    return error(
      kubectlUnexpectedArgsUsageError('kubectl create', positionalTokens)
    )
  }

  const name = findNameSkippingFlags(beforeSeparator, 3)
  const createImages = extractFlagValues(beforeSeparator, 'image')
  const hasCreateImages = createImages.length > 0
  const createFromLiterals = extractFlagValues(beforeSeparator, 'from-literal')
  const hasCreateFromLiterals = createFromLiterals.length > 0
  const createFromFiles = extractFlagValues(beforeSeparator, 'from-file')
  const hasCreateFromFiles = createFromFiles.length > 0
  const createFromEnvFiles = extractFlagValues(beforeSeparator, 'from-env-file')
  const hasCreateFromEnvFiles = createFromEnvFiles.length > 0

  if (resource === 'services') {
    const rawServiceType = findNameSkippingFlags(beforeSeparator, 3)
    const normalizedServiceType = rawServiceType?.toLowerCase()
    const createServiceType =
      normalizedServiceType != null &&
      CREATE_SERVICE_TYPES.has(normalizedServiceType)
        ? (normalizedServiceType as
            | 'clusterip'
            | 'nodeport'
            | 'loadbalancer'
            | 'externalname')
        : undefined
    const serviceName =
      createServiceType != null
        ? findNameSkippingFlags(beforeSeparator, 4)
        : undefined
    return success({
      ...ctx,
      resource,
      name: serviceName,
      tokens: beforeSeparator,
      createServiceType,
      createCommand
    })
  }

  if (resource === 'ingresses') {
    const createIngressClassValues = extractFlagValues(beforeSeparator, 'class')
    const createIngressRules = extractFlagValues(beforeSeparator, 'rule')
    const createIngressClassName =
      createIngressClassValues.length > 0
        ? createIngressClassValues[0]
        : undefined
    return success({
      ...ctx,
      resource,
      name,
      tokens: beforeSeparator,
      createIngressClassName,
      createIngressRules:
        createIngressRules.length > 0 ? createIngressRules : undefined,
      createCommand
    })
  }

  if (resource === 'secrets') {
    const rawSecretType = findNameSkippingFlags(beforeSeparator, 3)
    const normalizedSecretType = rawSecretType?.toLowerCase()
    const createSecretType =
      normalizedSecretType != null &&
      CREATE_SECRET_TYPES.has(normalizedSecretType)
        ? (normalizedSecretType as 'generic' | 'tls' | 'docker-registry')
        : undefined
    const secretName =
      createSecretType != null
        ? findNameSkippingFlags(beforeSeparator, 4)
        : undefined
    return success({
      ...ctx,
      resource,
      name: secretName,
      tokens: beforeSeparator,
      createSecretType,
      createFromLiterals: hasCreateFromLiterals
        ? createFromLiterals
        : undefined,
      createFromFiles: hasCreateFromFiles ? createFromFiles : undefined,
      createFromEnvFiles: hasCreateFromEnvFiles
        ? createFromEnvFiles
        : undefined,
      createCommand
    })
  }

  return success({
    ...ctx,
    resource,
    name,
    tokens: beforeSeparator,
    createImages: hasCreateImages ? createImages : undefined,
    createFromLiterals: hasCreateFromLiterals ? createFromLiterals : undefined,
    createFromFiles: hasCreateFromFiles ? createFromFiles : undefined,
    createFromEnvFiles: hasCreateFromEnvFiles ? createFromEnvFiles : undefined,
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

  const parsedTarget = parseResourceTargetToken(ctx.tokens[2])
  if (!parsedTarget.ok) {
    return parsedTarget
  }

  const name = parsedTarget.value.name ?? findNameSkippingFlags(ctx.tokens, 3)

  // Parse label changes from tokens after name
  // type/name uses index 2 as target, resource name syntax uses index 3
  const changesStartIndex = parsedTarget.value.usesTypeNameSyntax ? 3 : 4
  const changesTokens = ctx.tokens.slice(changesStartIndex)
  const labelChanges = parseChanges(changesTokens)

  return success({
    ...ctx,
    resource: parsedTarget.value.resource,
    name,
    labelChanges
  })
}

/**
 * Transformer for annotate command: sets resource, extracts name and annotation changes
 */
const annotateTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens) {
    return success(ctx)
  }

  const parsedTarget = parseResourceTargetToken(ctx.tokens[2])
  if (!parsedTarget.ok) {
    return parsedTarget
  }

  const name = parsedTarget.value.name ?? findNameSkippingFlags(ctx.tokens, 3)

  // Parse annotation changes from tokens after name
  // type/name uses index 2 as target, resource name syntax uses index 3
  const changesStartIndex = parsedTarget.value.usesTypeNameSyntax ? 3 : 4
  const changesTokens = ctx.tokens.slice(changesStartIndex)
  const annotationChanges = parseChanges(changesTokens)

  return success({
    ...ctx,
    resource: parsedTarget.value.resource,
    name,
    annotationChanges
  })
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
 * Transformer for api-versions command: explicitly sets resource to undefined
 * Api-versions command doesn't require a resource
 */
const apiVersionsTransformer: ActionTransformer = (ctx) => {
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
 * Transformer for explain command: extracts resource and field path.
 * Supports:
 * - kubectl explain pod
 * - kubectl explain pod.spec.containers
 */
const explainTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens) {
    return error('you must specify the type of resource to explain')
  }

  const positionalTokens = extractPositionalTokensAfterAction(ctx.tokens)
  if (positionalTokens.length === 0) {
    return error('you must specify the type of resource to explain')
  }
  if (positionalTokens.length > 1) {
    return error('We accept only this format: explain RESOURCE')
  }

  const parsedExplainPath = splitExplainPath(positionalTokens[0])
  if (!parsedExplainPath) {
    return error('invalid explain resource path')
  }

  const resource = RESOURCE_ALIAS_MAP[parsedExplainPath.resourceToken] as
    | Resource
    | undefined
  if (!resource) {
    return error('Invalid or missing resource type')
  }

  return success({
    ...ctx,
    resource,
    explainPath: parsedExplainPath.explainPath
  })
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
  const resolvedTarget = resolveResourceAndNameFromTargetToken(
    resourceToken,
    nameToken
  )
  if (!resolvedTarget.ok) {
    return resolvedTarget
  }

  return success({
    ...ctx,
    resource: resolvedTarget.value.resource,
    name: resolvedTarget.value.name
  })
}

/**
 * Transformer for run command:
 * - kubectl run NAME --image=busybox --command -- sleep 3600
 */
const runTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens) {
    return success(ctx)
  }

  const tokens = ctx.tokens
  const { beforeSeparator, afterSeparator } = splitTokensBySeparator(tokens)
  const runHasSeparator = tokens.includes('--')
  const positionalTokens = extractPositionalTokensAfterAction(beforeSeparator)
  const name = positionalTokens[0]
  const runImages = extractFlagValues(beforeSeparator, 'image')
  const runImage = runImages.length > 0 ? runImages[0] : undefined
  const runEnvs = extractFlagValues(beforeSeparator, 'env')
  const runLabels = parseRunLabels(extractFlagValues(beforeSeparator, 'labels'))
  const dryRunValues = extractFlagValues(beforeSeparator, 'dry-run')
  const runDryRunClient = dryRunValues.includes('client')
  const restartValues = extractFlagValues(beforeSeparator, 'restart')
  const runRestart =
    restartValues.length > 0
      ? (restartValues[0] as 'Always' | 'OnFailure' | 'Never')
      : undefined
  const runUseCommand = beforeSeparator.includes('--command')
  const runStdin =
    beforeSeparator.includes('--stdin') || hasShortFlag(beforeSeparator, 'i')
  const runTty =
    beforeSeparator.includes('--tty') || hasShortFlag(beforeSeparator, 't')
  const runRemove = beforeSeparator.includes('--rm')
  const separatorTokens =
    afterSeparator && afterSeparator.length > 0 ? afterSeparator : undefined
  const positionalArgsWithoutSeparator =
    positionalTokens.length > 1 ? positionalTokens.slice(1) : undefined
  const runCommand =
    runUseCommand && separatorTokens ? separatorTokens : undefined
  const runArgs = !runUseCommand
    ? separatorTokens || positionalArgsWithoutSeparator
    : undefined

  return success({
    ...ctx,
    resource: 'pods' as Resource,
    name,
    tokens: beforeSeparator,
    runImage,
    runCommand,
    runArgs,
    runUseCommand,
    runHasSeparator,
    runEnv: runEnvs.length > 0 ? runEnvs : undefined,
    runLabels,
    runDryRunClient,
    runRestart,
    runStdin,
    runTty,
    runRemove
  })
}

/**
 * Transformer for delete:
 * - delete -f file.yaml
 * - delete <resource> <name>
 */
const deleteTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens) {
    return success(ctx)
  }

  if (!hasFilenameFlagInTokens(ctx.tokens, 2)) {
    return success(ctx)
  }

  return success({
    ...ctx,
    resource: 'pods' as Resource
  })
}

/**
 * Transformer for replace:
 * - replace -f file.yaml
 * - replace --force -f file.yaml
 */
const replaceTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens) {
    return success(ctx)
  }

  if (!hasFilenameFlagInTokens(ctx.tokens, 2)) {
    return success(ctx)
  }

  return success({
    ...ctx,
    resource: 'pods' as Resource
  })
}

const parseSetImageAssignments = (
  assignmentTokens: string[]
): Record<string, string> | undefined => {
  const assignments: Record<string, string> = {}
  for (const assignmentToken of assignmentTokens) {
    const separatorIndex = assignmentToken.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }
    const containerName = assignmentToken.slice(0, separatorIndex).trim()
    const image = assignmentToken.slice(separatorIndex + 1).trim()
    if (containerName.length === 0 || image.length === 0) {
      continue
    }
    assignments[containerName] = image
  }
  if (Object.keys(assignments).length === 0) {
    return undefined
  }
  return assignments
}

const setTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens) {
    return success(ctx)
  }
  const subcommandToken = ctx.tokens[2]
  if (subcommandToken !== 'image') {
    return success(ctx)
  }

  const positionalTokens = extractPositionalTokensFromIndex(ctx.tokens, 3)
  const targetToken = positionalTokens[0]
  if (targetToken == null) {
    return success({
      ...ctx,
      setSubcommand: 'image'
    })
  }

  let resource: Resource | undefined
  let name: string | undefined
  let assignmentStartIndex = 1
  if (targetToken.includes('/')) {
    const [resourceToken, nameToken] = targetToken.split('/', 2)
    resource = RESOURCE_ALIAS_MAP[resourceToken] as Resource | undefined
    name = nameToken
  } else {
    resource = RESOURCE_ALIAS_MAP[targetToken] as Resource | undefined
    name = positionalTokens[1]
    assignmentStartIndex = 2
  }

  const assignmentTokens = positionalTokens.slice(assignmentStartIndex)
  return success({
    ...ctx,
    setSubcommand: 'image',
    resource,
    name,
    setImageAssignments: parseSetImageAssignments(assignmentTokens)
  })
}

const editTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens) {
    return success(ctx)
  }

  const positionalTokens = extractPositionalTokensAfterAction(ctx.tokens)
  const targetToken = positionalTokens[0]
  if (targetToken == null) {
    return success(ctx)
  }

  const resolvedTarget = resolveResourceAndNameFromTargetToken(
    targetToken,
    positionalTokens[1]
  )
  if (!resolvedTarget.ok) {
    return resolvedTarget
  }

  return success({
    ...ctx,
    resource: resolvedTarget.value.resource,
    name: resolvedTarget.value.name
  })
}

const exposeTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens) {
    return success(ctx)
  }

  const resourceToken = ctx.tokens[2]
  if (!resourceToken || resourceToken.startsWith('-')) {
    return error('Invalid or missing resource type')
  }

  const resolvedTarget = resolveResourceAndNameFromTargetToken(
    resourceToken,
    findNameSkippingFlags(ctx.tokens, 3)
  )
  if (!resolvedTarget.ok) {
    return resolvedTarget
  }
  return success({
    ...ctx,
    resource: resolvedTarget.value.resource,
    name: resolvedTarget.value.name
  })
}

const patchTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens) {
    return success(ctx)
  }

  const positionalTokens = extractPositionalTokensAfterAction(ctx.tokens)
  const targetToken = positionalTokens[0]
  if (targetToken == null) {
    return success(ctx)
  }

  const resolvedTarget = resolveResourceAndNameFromTargetToken(
    targetToken,
    positionalTokens[1]
  )
  if (!resolvedTarget.ok) {
    return resolvedTarget
  }

  return success({
    ...ctx,
    resource: resolvedTarget.value.resource,
    name: resolvedTarget.value.name
  })
}

const configTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens || ctx.tokens.length < 3) {
    return error('config requires a subcommand')
  }

  const subcommandToken = ctx.tokens[2]
  const transformSpec = find(CONFIG_SUBCOMMAND_SPECS, (spec) => {
    return spec.token === subcommandToken
  })
  if (transformSpec == null) {
    return error(`unknown config subcommand: ${subcommandToken}`)
  }

  const enrichedFields: Partial<ParseContext> = (() => {
    if (transformSpec.transformKind === 'contextName') {
      return {
        configContextName: findNameSkippingFlags(ctx.tokens, 3)
      }
    }
    if (transformSpec.transformKind === 'userName') {
      return {
        configUserName: findNameSkippingFlags(ctx.tokens, 3)
      }
    }
    if (transformSpec.transformKind === 'clusterName') {
      return {
        configClusterName: findNameSkippingFlags(ctx.tokens, 3)
      }
    }
    if (transformSpec.transformKind === 'path') {
      return {
        configPath: findNameSkippingFlags(ctx.tokens, 3)
      }
    }
    if (transformSpec.transformKind === 'renameContext') {
      const positionalTokens = extractPositionalTokensFromIndex(ctx.tokens, 3)
      return {
        configContextName: findNameSkippingFlags(ctx.tokens, 3),
        configRenameContextTo: positionalTokens[1]
      }
    }
    return {}
  })()

  return success({
    ...ctx,
    action: transformSpec.action,
    resource: undefined,
    configSubcommand: transformSpec.subcommand,
    ...enrichedFields
  })
}

const authTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens || ctx.tokens.length < 3) {
    return error('auth requires a subcommand')
  }

  const subcommandToken = ctx.tokens[2]
  const transformSpec = find(AUTH_SUBCOMMAND_SPECS, (spec) => {
    return spec.token === subcommandToken
  })
  if (transformSpec == null) {
    return error(`unknown auth subcommand: ${subcommandToken}`)
  }

  const enrichedFields: Partial<ParseContext> =
    transformSpec.transformKind === 'verbResource'
      ? (() => {
          const positionalTokens = extractPositionalTokensFromIndex(ctx.tokens, 3)
          return {
            authVerb: positionalTokens[0],
            authResource: positionalTokens[1]
          }
        })()
      : {}

  return success({
    ...ctx,
    action: transformSpec.action,
    resource: undefined,
    ...enrichedFields
  })
}

const parseWaitTimeoutSeconds = (value: string): number => {
  return parseDurationSeconds(value)
}

const parseDurationSeconds = (value: string): number => {
  const trimmed = value.trim()
  if (trimmed.endsWith('s')) {
    return parseInt(trimmed.slice(0, -1), 10) || 60
  }
  if (trimmed.endsWith('m')) {
    return (parseInt(trimmed.slice(0, -1), 10) || 1) * 60
  }
  if (trimmed.endsWith('h')) {
    return (parseInt(trimmed.slice(0, -1), 10) || 1) * 3600
  }
  return parseInt(trimmed, 10) || 60
}

const waitTransformer: ActionTransformer = (ctx) => {
  const tokens = ctx.tokens
  if (!tokens || tokens.length < 3) {
    return error('wait requires resource/name and --for')
  }

  let waitForCondition: string | undefined
  let waitTimeoutSeconds = 60
  let firstPositional: string | undefined

  // First pass: collect --for and --timeout from any position in the token list
  for (let i = 2; i < tokens.length; i++) {
    const token = tokens[i]
    if (token === '--') {
      break
    }
    if (token.startsWith('--for=')) {
      waitForCondition = token.slice('--for='.length).trim()
      continue
    }
    if (token.startsWith('--timeout=')) {
      waitTimeoutSeconds = parseWaitTimeoutSeconds(
        token.slice('--timeout='.length)
      )
      continue
    }
    if (token === '-n' || token === '--namespace') {
      i++
      continue
    }
    if (token.startsWith('-')) {
      const eq = token.indexOf('=')
      if (eq > 0) {
        const flagName = token.slice(0, eq).replace(/^-+/, '')
        if (flagName === 'for') {
          waitForCondition = token.slice(eq + 1).trim()
        }
        if (flagName === 'timeout') {
          waitTimeoutSeconds = parseWaitTimeoutSeconds(token.slice(eq + 1))
        }
      } else if (FLAGS_REQUIRING_VALUES.has(token.replace(/^-+/, ''))) {
        i++
      }
      continue
    }
    if (firstPositional === undefined) {
      firstPositional = token
    }
  }

  if (firstPositional === undefined) {
    return error('wait requires resource/name')
  }

  const slashIndex = firstPositional.indexOf('/')
  if (slashIndex <= 0 || slashIndex === firstPositional.length - 1) {
    return error('wait requires resource/name format')
  }

  const typePart = firstPositional.slice(0, slashIndex)
  const namePart = firstPositional.slice(slashIndex + 1)
  const resource = RESOURCE_ALIAS_MAP[typePart] as Resource | undefined
  if (!resource) {
    return error(`Invalid or missing resource type: ${typePart}`)
  }

  return success({
    ...ctx,
    resource,
    name: namePart,
    waitForCondition: waitForCondition ?? 'condition=Ready',
    waitTimeoutSeconds
  })
}

const parseBooleanFlagValue = (
  value: string | boolean
): boolean | undefined => {
  if (typeof value === 'boolean') {
    return value
  }
  if (value === 'true') {
    return true
  }
  if (value === 'false') {
    return false
  }
  return undefined
}

const rolloutTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens) {
    return success(ctx)
  }

  const subcommandToken = ctx.tokens[2]
  if (subcommandToken == null) {
    return success(ctx)
  }
  if (
    subcommandToken !== 'status' &&
    subcommandToken !== 'history' &&
    subcommandToken !== 'restart' &&
    subcommandToken !== 'undo'
  ) {
    return error(`error: invalid subcommand for rollout: ${subcommandToken}`)
  }

  const positionalTokens = extractPositionalTokensFromIndex(ctx.tokens, 3)
  const targetToken = positionalTokens[0]
  if (targetToken == null) {
    return success({
      ...ctx,
      rolloutSubcommand: subcommandToken
    })
  }

  let resource: Resource | undefined
  let name: string | undefined
  if (targetToken.includes('/')) {
    const [resourceToken, nameToken] = targetToken.split('/', 2)
    resource = RESOURCE_ALIAS_MAP[resourceToken] as Resource | undefined
    name = nameToken
  } else {
    resource = RESOURCE_ALIAS_MAP[targetToken] as Resource | undefined
    name = positionalTokens[1]
  }

  let rolloutRevision: number | undefined
  let rolloutTimeoutSeconds: number | undefined
  let rolloutWatch: boolean | undefined

  for (let index = 3; index < ctx.tokens.length; index++) {
    const token = ctx.tokens[index]
    if (token === '--') {
      break
    }
    if (token.startsWith('--revision=')) {
      rolloutRevision = parseInt(token.slice('--revision='.length), 10)
      continue
    }
    if (token.startsWith('--to-revision=')) {
      rolloutRevision = parseInt(token.slice('--to-revision='.length), 10)
      continue
    }
    if (token.startsWith('--timeout=')) {
      rolloutTimeoutSeconds = parseDurationSeconds(
        token.slice('--timeout='.length)
      )
      continue
    }
    if (token.startsWith('--watch=')) {
      rolloutWatch = parseBooleanFlagValue(token.slice('--watch='.length))
      continue
    }
    if (token === '--watch') {
      const nextToken = ctx.tokens[index + 1]
      if (nextToken == null || nextToken.startsWith('-')) {
        rolloutWatch = true
      } else {
        rolloutWatch = parseBooleanFlagValue(nextToken)
        index += 1
      }
      continue
    }
  }

  return success({
    ...ctx,
    rolloutSubcommand: subcommandToken,
    resource,
    name,
    rolloutRevision,
    rolloutTimeoutSeconds,
    rolloutWatch
  })
}

const topTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens) {
    return success(ctx)
  }

  const subcommandToken = ctx.tokens[2]
  if (subcommandToken == null) {
    return error('error: top requires one of: pods, pod, nodes, node')
  }

  const isPodsSubcommand =
    subcommandToken === 'pods' || subcommandToken === 'pod'
  const isNodesSubcommand =
    subcommandToken === 'nodes' || subcommandToken === 'node'
  if (!isPodsSubcommand && !isNodesSubcommand) {
    return error(`error: invalid subcommand for top: ${subcommandToken}`)
  }

  const positionalTokens = extractPositionalTokensFromIndex(ctx.tokens, 3)
  const name = positionalTokens[0]

  return success({
    ...ctx,
    action: isPodsSubcommand ? 'top-pods' : 'top-nodes',
    topSubcommand: isPodsSubcommand ? 'pods' : 'nodes',
    name
  })
}

/**
 * Default transformer: no-op, returns context as-is
 */
const identityTransformer: ActionTransformer = (ctx) => success(ctx)

const getTransformer: ActionTransformer = (ctx) => {
  if (!ctx.tokens) {
    return success(ctx)
  }

  const positionalTokens = extractPositionalTokensAfterAction(ctx.tokens)
  const firstPositional = positionalTokens[0]
  if (firstPositional == null) {
    return success(ctx)
  }
  if (!firstPositional.includes(',')) {
    return success(ctx)
  }

  const resourceTokens = firstPositional
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
  if (resourceTokens.length === 0) {
    return success(ctx)
  }

  const resources: Resource[] = []
  for (const resourceToken of resourceTokens) {
    const resource = RESOURCE_ALIAS_MAP[resourceToken] as Resource | undefined
    if (resource == null) {
      return error('Invalid or missing resource type')
    }
    resources.push(resource)
  }

  return success({
    ...ctx,
    resource: resources[0],
    resourceList: resources
  })
}

/**
 * Map of action-specific transformers
 * Add new actions here without modifying the pipeline
 */
const ACTIONS_WITH_CUSTOM_PARSING: Record<string, ActionTransformer> = {
  get: getTransformer,
  exec: execTransformer,
  logs: logsTransformer,
  delete: deleteTransformer,
  replace: replaceTransformer,
  apply: applyTransformer,
  create: createTransformer,
  label: labelTransformer,
  annotate: annotateTransformer,
  version: versionTransformer,
  'cluster-info': clusterInfoTransformer,
  'api-versions': apiVersionsTransformer,
  'api-resources': apiResourcesTransformer,
  explain: explainTransformer,
  scale: scaleTransformer,
  run: runTransformer,
  set: setTransformer,
  edit: editTransformer,
  expose: exposeTransformer,
  patch: patchTransformer,
  wait: waitTransformer,
  rollout: rolloutTransformer,
  top: topTransformer,
  config: configTransformer,
  auth: authTransformer
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
