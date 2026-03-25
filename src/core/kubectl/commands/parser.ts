import {
  checkFlags,
  extract,
  parseFlags,
  pipeResult,
  tokenize,
  trim
} from '../../shared/parsing'
import {
  parseKubectlLabelSelector,
  type LabelSelector
} from '../../shared/labelSelector'
import type { Result } from '../../shared/result'
import { error, success } from '../../shared/result'
import { RESOURCE_ALIAS_MAP } from './resources'
import { getTransformerForAction, type ParseContext } from './transformers'
import type { Action, ParsedCommand, Resource } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL COMMAND PARSER
// ═══════════════════════════════════════════════════════════════════════════
// Parses kubectl command strings with resource aliases and namespace flags.
// Supports all kubectl actions (get, describe, delete, apply, create).
//
// Uses Railway-oriented programming (pipeResult) for clean pipeline composition.
// Each step transforms a ParseContext and can fail, stopping the pipeline.

// ─── Constants ───────────────────────────────────────────────────────────

const VALID_ACTIONS: Action[] = [
  'get',
  'diff',
  'explain',
  'describe',
  'edit',
  'set',
  'delete',
  'apply',
  'replace',
  'create',
  'logs',
  'exec',
  'label',
  'annotate',
  'version',
  'cluster-info',
  'api-versions',
  'api-resources',
  'scale',
  'patch',
  'run',
  'expose',
  'wait',
  'rollout',
  'config'
]

// Flag aliases: short form → long form
const FLAG_ALIASES: Record<string, string> = {
  n: 'namespace',
  o: 'output',
  l: 'selector',
  f: 'filename', // Note: -f is also used for --follow in logs, but filename takes precedence
  p: 'patch',
  A: 'all-namespaces',
  c: 'container', // Container name for logs/exec
  R: 'recursive',
  i: 'stdin',
  t: 'tty'
}

// Flags that require a value (cannot be boolean)
const FLAGS_REQUIRING_VALUES = [
  'n',
  'namespace',
  'o',
  'output',
  'l',
  'selector',
  'filename',
  'tail',
  'since',
  'c',
  'container',
  'namespaces',
  'output-directory',
  'replicas',
  'image',
  'port',
  'env',
  'labels',
  'dry-run',
  'restart',
  'raw',
  'api-version',
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
  'p',
  'patch',
  'revision',
  'timeout',
  'grace-period'
]
// Note: 'filename' is required for apply/create, but 'f' and 'follow' are boolean for logs

// Output formats for kubectl commands
type OutputFormat = 'table' | 'yaml' | 'json'
const VALID_OUTPUT_FORMATS = new Set<OutputFormat>(['table', 'yaml', 'json'])

const ACTIONS_WITHOUT_RESOURCE: Action[] = [
  'version',
  'cluster-info',
  'api-versions',
  'api-resources',
  'diff',
  'replace',
  'set',
  'config-get-contexts',
  'config-current-context',
  'config-view',
  'config-set-context'
]

// ─── Main Parsing Pipeline ──────────────────────────────────────────────

/**
 * Main entry point for parsing kubectl commands
 *
 * Pipeline: validate input → tokenize → validate kubectl → extract action →
 *           apply action-specific transform → parse flags → extract resource/name → validate
 */
export const parseCommand = (input: string): Result<ParsedCommand> => {
  // Generic parsing pipeline (works for all commands)
  const genericPipeline = pipeResult<ParseContext>(
    trim,
    tokenize,
    checkKubectl,
    extract(1, VALID_ACTIONS, 'action', 'Invalid or missing action')
  )

  const genericResult = genericPipeline({ input })
  if (!genericResult.ok) {
    return genericResult
  }

  // Apply action-specific transformation
  const transformer = getTransformerForAction(genericResult.value.action)
  const transformedResult = transformer(genericResult.value)
  if (!transformedResult.ok) {
    return transformedResult
  }

  // Continue with common parsing
  const commandPipeline = pipeResult<ParseContext>(
    parseFlags(1, FLAG_ALIASES),
    checkFlags(FLAGS_REQUIRING_VALUES),
    extractResource,
    extractName,
    checkSemantics,
    build
  )

  const result = commandPipeline(transformedResult.value)

  // Transform ParseContext result to ParsedCommand result
  if (!result.ok) {
    return result
  }

  // Extract the command from the final context
  const ctx = result.value
  if (!ctx.action || !ctx.flags) {
    return error('Internal parsing error: incomplete context')
  }

  const normalizedFlags = ctx.normalizedFlags || ctx.flags
  const parsedNames = getNamesFromTokens(
    ctx.action,
    ctx.tokens || [],
    normalizedFlags,
    ctx.resourceTokenIndex
  )
  const parsedSelector = getSelectorFromFlags(normalizedFlags)
  if (!parsedSelector.ok) {
    return error(parsedSelector.error)
  }

  return success({
    action: ctx.action,
    configSubcommand: ctx.configSubcommand,
    resource: ctx.resource, // May be undefined for commands like 'version'
    rawPath: getRawPathFromFlags(normalizedFlags),
    name: ctx.name,
    names: parsedNames,
    namespace: getNamespaceFromFlags(normalizedFlags),
    output: getOutputFromFlags(normalizedFlags),
    selector: parsedSelector.value,
    flags: ctx.flags,
    execCommand: ctx.execCommand,
    createImages: ctx.createImages,
    createCommand: ctx.createCommand,
    createServiceType: ctx.createServiceType,
    createSecretType: ctx.createSecretType,
    createFromLiterals: ctx.createFromLiterals,
    createFromFiles: ctx.createFromFiles,
    createFromEnvFiles: ctx.createFromEnvFiles,
    runImage: ctx.runImage,
    runCommand: ctx.runCommand,
    runArgs: ctx.runArgs,
    runUseCommand: ctx.runUseCommand,
    runHasSeparator: ctx.runHasSeparator,
    runEnv: ctx.runEnv,
    runLabels: ctx.runLabels,
    runDryRunClient: ctx.runDryRunClient,
    runRestart: ctx.runRestart,
    runStdin: ctx.runStdin,
    runTty: ctx.runTty,
    runRemove: ctx.runRemove,
    setSubcommand: ctx.setSubcommand,
    setImageAssignments: ctx.setImageAssignments,
    rolloutSubcommand: ctx.rolloutSubcommand,
    rolloutRevision: ctx.rolloutRevision,
    rolloutTimeoutSeconds: ctx.rolloutTimeoutSeconds,
    rolloutWatch: ctx.rolloutWatch,
    configCurrent: getConfigCurrentFromFlags(normalizedFlags),
    configMinify: getConfigMinifyFromFlags(normalizedFlags),
    configNamespace: getConfigNamespaceFromFlags(normalizedFlags),
    explainPath: ctx.explainPath,
    labelChanges: ctx.labelChanges,
    annotationChanges: ctx.annotationChanges,
    replicas: getReplicasFromFlags(normalizedFlags),
    port: getPortFromFlags(normalizedFlags),
    waitForCondition: ctx.waitForCondition,
    waitTimeoutSeconds: ctx.waitTimeoutSeconds,
    patchPayload: getPatchPayloadFromFlags(normalizedFlags),
    patchType: getPatchTypeFromFlags(normalizedFlags),
    deleteGracePeriodSeconds:
      getDeleteGracePeriodSecondsFromFlags(normalizedFlags),
    deleteForce: getDeleteForceFromFlags(normalizedFlags)
  })
}

// ─── Pipeline Steps ──────────────────────────────────────────────────────
// Each step: ParseContext → Result<ParseContext>

const checkKubectl = (ctx: ParseContext): Result<ParseContext> => {
  if (!ctx.tokens || ctx.tokens[0] !== 'kubectl') {
    return error('Command must start with kubectl')
  }
  return success(ctx)
}

const extractResource = (ctx: ParseContext): Result<ParseContext> => {
  // Skip if resource already set by transformer
  if (ctx.resource !== undefined) {
    return success(ctx)
  }

  // Commands like 'version', 'cluster-info', 'api-versions', 'api-resources' and 'diff' don't require a resource
  if (ctx.action && ACTIONS_WITHOUT_RESOURCE.includes(ctx.action)) {
    return success(ctx)
  }

  const rawPath = getRawPathFromFlags(ctx.normalizedFlags || ctx.flags || {})
  if (ctx.action === 'get' && typeof rawPath === 'string') {
    return success({ ...ctx, resource: undefined })
  }

  if (!ctx.tokens || ctx.tokens.length < 3) {
    return error('Invalid or missing resource type')
  }

  const resourceCandidate = findTokenSkippingFlags(ctx.tokens, 2)
  if (!resourceCandidate) {
    return error('Invalid or missing resource type')
  }

  // Lookup canonical resource from alias map
  const resource = RESOURCE_ALIAS_MAP[resourceCandidate.token] as
    | Resource
    | undefined

  if (!resource) {
    return error('Invalid or missing resource type')
  }

  return success({
    ...ctx,
    resource,
    resourceTokenIndex: resourceCandidate.index
  })
}

/**
 * Find name by skipping flags - works for dynamic position commands (logs/exec/apply/create)
 */
const findNameSkippingFlags = (
  tokens: string[],
  startPos: number
): string | undefined => {
  const candidate = findTokenSkippingFlags(tokens, startPos)
  return candidate?.token
}

const getFlagName = (token: string): string => {
  return token.replace(/^-+/, '').split('=')[0]
}

const findTokenSkippingFlags = (
  tokens: string[],
  startPos: number
): { token: string; index: number } | undefined => {
  for (let i = startPos; i < tokens.length; i++) {
    const token = tokens[i]

    if (token === '--') {
      break // Stop at -- separator (for exec)
    }

    if (token.startsWith('-')) {
      // Skip flag and its value if needed
      const flagName = getFlagName(token)
      if (FLAGS_REQUIRING_VALUES.includes(flagName) && !token.includes('=')) {
        i++
      }
      continue
    }

    return { token, index: i } // Found it!
  }

  return undefined
}

const extractName = (ctx: ParseContext): Result<ParseContext> => {
  // Skip if name already set by transformer (check for property, not just truthiness)
  if ('name' in ctx && ctx.name !== undefined) {
    return success(ctx)
  }

  // Also skip for label/annotate since transformer handles name extraction
  if (ctx.action === 'label' || ctx.action === 'annotate') {
    return success(ctx)
  }

  if (!ctx.tokens) {
    return success(ctx)
  }

  if (
    ctx.action === 'create' &&
    ctx.resource === 'services' &&
    ctx.createServiceType != null
  ) {
    return success(ctx)
  }
  if (
    ctx.action === 'create' &&
    ctx.resource === 'secrets' &&
    ctx.createSecretType != null
  ) {
    return success(ctx)
  }

  // Actions with custom transformers parse name differently
  const actionsWithCustomParsing = [
    'exec',
    'logs',
    'apply',
    'replace',
    'set',
    'label',
    'annotate',
    'explain',
    'run',
    'rollout'
  ]
  const hasTransformer =
    ctx.action && actionsWithCustomParsing.includes(ctx.action)

  const startIndexForResourceName =
    ctx.resourceTokenIndex != null ? ctx.resourceTokenIndex + 1 : 3

  const name = hasTransformer
    ? findNameSkippingFlags(ctx.tokens, 2) // Position 2: kubectl <action> <name>
    : findNameSkippingFlags(ctx.tokens, startIndexForResourceName)

  return success({ ...ctx, name })
}

const checkSemantics = (ctx: ParseContext): Result<ParseContext> => {
  if (!ctx.action) {
    return error('Missing action')
  }

  // Commands like 'version', 'cluster-info', 'api-versions', 'api-resources' and 'diff' don't require a resource
  if (ACTIONS_WITHOUT_RESOURCE.includes(ctx.action)) {
    const validationError = validateCommandSemantics(
      ctx.action,
      ctx.resource,
      ctx.name,
      ctx.normalizedFlags || ctx.flags || {},
      ctx.tokens || [],
      ctx.createServiceType,
      ctx.createSecretType
    )
    if (validationError) {
      return error(validationError)
    }
    return success(ctx)
  }

  const rawPath = getRawPathFromFlags(ctx.normalizedFlags || ctx.flags || {})
  if (ctx.action === 'get' && typeof rawPath === 'string') {
    const validationError = validateCommandSemantics(
      ctx.action,
      ctx.resource,
      ctx.name,
      ctx.normalizedFlags || ctx.flags || {},
      ctx.tokens || [],
      ctx.createServiceType,
      ctx.createSecretType
    )
    if (validationError) {
      return error(validationError)
    }
    return success(ctx)
  }

  if (!ctx.resource) {
    return error('Missing resource')
  }

  const validationError = validateCommandSemantics(
    ctx.action,
    ctx.resource,
    ctx.name,
    ctx.normalizedFlags || ctx.flags || {},
    ctx.tokens || [],
    ctx.createServiceType,
    ctx.createSecretType
  )
  if (validationError) {
    return error(validationError)
  }

  return success(ctx)
}

const build = (ctx: ParseContext): Result<ParseContext> => {
  return success(ctx)
}

// ─── Flag Helpers ────────────────────────────────────────────────────────

/**
 * Get namespace from normalized flags with default fallback
 * Supports both -n and --all-namespaces
 */
const getNamespaceFromFlags = (
  flags: Record<string, string | boolean>
): string | undefined => {
  // --all-namespaces takes precedence
  if (flags['all-namespaces'] === true) {
    return undefined // Signals all namespaces
  }

  // Otherwise use explicit namespace or default
  const ns = flags['namespace']
  return typeof ns === 'string' ? ns : undefined
}

/**
 * Get output format from normalized flags with default fallback
 */
const getOutputFromFlags = (
  flags: Record<string, string | boolean>
): OutputFormat => {
  const output = flags['output']

  if (
    typeof output === 'string' &&
    VALID_OUTPUT_FORMATS.has(output as OutputFormat)
  ) {
    return output as OutputFormat
  }

  return 'table' // Default
}

/**
 * Get selector from normalized flags and parse it
 */
const getSelectorFromFlags = (
  flags: Record<string, string | boolean>
): Result<LabelSelector | undefined> => {
  const selector = flags['selector']

  if (typeof selector === 'string') {
    const parsedSelector = parseKubectlLabelSelector(selector)
    if (!parsedSelector.ok) {
      return error(`error: ${parsedSelector.error}`)
    }
    return success(parsedSelector.value)
  }

  return success(undefined)
}

/**
 * Get replicas from normalized flags for scale command
 */
const getReplicasFromFlags = (
  flags: Record<string, string | boolean>
): number | undefined => {
  const replicas = flags['replicas']

  if (typeof replicas === 'string') {
    const parsed = parseInt(replicas, 10)
    return isNaN(parsed) ? undefined : parsed
  }

  return undefined
}

const getPortFromFlags = (
  flags: Record<string, string | boolean>
): number | undefined => {
  const port = flags['port']
  if (typeof port !== 'string') {
    return undefined
  }

  const parsed = parseInt(port, 10)
  if (isNaN(parsed)) {
    return undefined
  }

  return parsed
}

const getRawPathFromFlags = (
  flags: Record<string, string | boolean>
): string | undefined => {
  const raw = flags['raw']
  if (typeof raw === 'string') {
    return raw
  }
  return undefined
}

const getNamesFromTokens = (
  action: Action,
  tokens: string[],
  flags: Record<string, string | boolean>,
  resourceTokenIndex?: number
): string[] | undefined => {
  if (action !== 'get' && action !== 'delete') {
    return undefined
  }
  if (action === 'get' && getRawPathFromFlags(flags) !== undefined) {
    return undefined
  }
  if (resourceTokenIndex == null) {
    return undefined
  }

  const names: string[] = []
  for (let index = resourceTokenIndex + 1; index < tokens.length; index++) {
    const token = tokens[index]
    if (token === '--') {
      break
    }
    if (token.startsWith('-')) {
      const flagName = getFlagName(token)
      if (FLAGS_REQUIRING_VALUES.includes(flagName) && !token.includes('=')) {
        index = index + 1
      }
      continue
    }
    names.push(token)
  }

  if (names.length === 0) {
    return undefined
  }
  return names
}

const getConfigCurrentFromFlags = (
  flags: Record<string, string | boolean>
): boolean => {
  return flags['current'] === true
}

const getConfigMinifyFromFlags = (
  flags: Record<string, string | boolean>
): boolean => {
  return flags['minify'] === true
}

const getConfigNamespaceFromFlags = (
  flags: Record<string, string | boolean>
): string | undefined => {
  const namespace = flags['namespace']
  if (typeof namespace === 'string') {
    return namespace
  }
  return undefined
}

const getPatchPayloadFromFlags = (
  flags: Record<string, string | boolean>
): string | undefined => {
  const patch = flags['patch']
  if (typeof patch === 'string') {
    return stripWrappingQuotes(patch)
  }
  return undefined
}

const stripWrappingQuotes = (value: string): string => {
  if (value.length < 2) {
    return value
  }
  const startsWithSingleQuote = value.startsWith("'") && value.endsWith("'")
  if (startsWithSingleQuote) {
    return value.slice(1, -1)
  }
  const startsWithDoubleQuote = value.startsWith('"') && value.endsWith('"')
  if (startsWithDoubleQuote) {
    return value.slice(1, -1)
  }
  return value
}

const getPatchTypeFromFlags = (
  flags: Record<string, string | boolean>
): 'merge' | undefined => {
  const patchType = flags['type']
  if (patchType === 'merge') {
    return 'merge'
  }
  return undefined
}

const getDeleteGracePeriodSecondsFromFlags = (
  flags: Record<string, string | boolean>
): number | undefined => {
  const gracePeriod = flags['grace-period']
  if (typeof gracePeriod !== 'string') {
    return undefined
  }
  const parsed = Number.parseInt(gracePeriod, 10)
  if (Number.isNaN(parsed) || parsed < 0) {
    return undefined
  }
  return parsed
}

const getDeleteForceFromFlags = (
  flags: Record<string, string | boolean>
): boolean => {
  return flags.force === true
}

// ─── Validation ──────────────────────────────────────────────────────────

/**
 * Validate command semantics (fail fast)
 * Returns error message if invalid, undefined if valid
 */
const validateCommandSemantics = (
  action: Action,
  resource: Resource | undefined,
  name?: string,
  flags: Record<string, string | boolean> = {},
  tokens: string[] = [],
  createServiceType?:
    | 'clusterip'
    | 'nodeport'
    | 'loadbalancer'
    | 'externalname',
  createSecretType?: 'generic' | 'tls' | 'docker-registry'
): string | undefined => {
  const hasFilename =
    typeof flags['filename'] === 'string' || typeof flags['f'] === 'string'
  const hasSelector =
    typeof flags['selector'] === 'string' || typeof flags['l'] === 'string'
  const canDeleteWithoutName =
    action === 'delete' && !hasFilename && (hasSelector || resource === 'all')

  const watchValidationError = validateGetWatchSemantics(action, flags)
  if (watchValidationError !== undefined) {
    return watchValidationError
  }

  const rawValidationError = validateGetRawSemantics(action, flags, tokens)
  if (rawValidationError !== undefined) {
    return rawValidationError
  }

  const requiresNameAction =
    action === 'describe' ||
    action === 'edit' ||
    action === 'logs' ||
    action === 'exec' ||
    action === 'label' ||
    action === 'annotate' ||
    action === 'scale' ||
    action === 'patch' ||
    action === 'expose' ||
    action === 'wait' ||
    action === 'rollout' ||
    (action === 'delete' && !hasFilename && !canDeleteWithoutName)

  if (requiresNameAction && !name) {
    return `${action} requires a resource name`
  }
  if (action === 'run') {
    const runImage = flags['image']
    if (typeof runImage !== 'string' || runImage.length === 0) {
      return 'error: required flag(s) "image" not set'
    }

    if (name == null || name.length === 0) {
      return 'run requires a resource name'
    }

    const dryRunFlag = flags['dry-run']
    if (
      dryRunFlag !== undefined &&
      dryRunFlag !== 'client' &&
      dryRunFlag !== 'server' &&
      dryRunFlag !== 'none'
    ) {
      return `error: Invalid dry-run value (${String(dryRunFlag)}). Must be "none", "server", or "client".`
    }

    const restartFlag = flags['restart']
    if (
      restartFlag !== undefined &&
      restartFlag !== 'Always' &&
      restartFlag !== 'OnFailure' &&
      restartFlag !== 'Never'
    ) {
      return `error: invalid restart policy: ${String(restartFlag)}`
    }
  }
  if (action === 'create') {
    const dryRunFlag = flags['dry-run']
    if (
      dryRunFlag !== undefined &&
      dryRunFlag !== 'client' &&
      dryRunFlag !== 'server' &&
      dryRunFlag !== 'none'
    ) {
      return `error: Invalid dry-run value (${String(dryRunFlag)}). Must be "none", "server", or "client".`
    }
    if (resource === 'services') {
      if (createServiceType == null) {
        return 'create service requires one of: clusterip, nodeport, loadbalancer, externalname'
      }
      if (name == null || name.length === 0) {
        return 'create service requires a service name'
      }
      const tcpFlag = flags['tcp']
      const externalNameFlag = flags['external-name']
      if (createServiceType === 'externalname') {
        if (
          typeof externalNameFlag !== 'string' ||
          externalNameFlag.trim().length === 0
        ) {
          return 'create service externalname requires flag --external-name'
        }
        if (tcpFlag !== undefined) {
          return 'create service externalname does not support flag --tcp'
        }
      } else {
        if (typeof tcpFlag !== 'string' || tcpFlag.trim().length === 0) {
          return 'create service requires flag --tcp'
        }
        if (externalNameFlag !== undefined) {
          return `create service ${createServiceType} does not support flag --external-name`
        }
      }
    }
    if (resource === 'configmaps') {
      if (name == null || name.length === 0) {
        return 'create configmap requires a name'
      }
      const fromLiteralFlag = flags['from-literal']
      if (
        typeof fromLiteralFlag !== 'string' ||
        fromLiteralFlag.trim().length === 0
      ) {
        return 'create configmap requires at least one --from-literal=key=value'
      }
    }
    if (resource === 'secrets') {
      if (createSecretType == null) {
        return 'create secret requires one of: generic, tls, docker-registry'
      }
      if (name == null || name.length === 0) {
        return 'create secret requires a name'
      }
      if (createSecretType === 'generic') {
        const fromLiteralFlag = flags['from-literal']
        const fromFileFlag = flags['from-file']
        const fromEnvFileFlag = flags['from-env-file']
        if (
          fromLiteralFlag === undefined &&
          fromFileFlag === undefined &&
          fromEnvFileFlag === undefined
        ) {
          return 'create secret generic requires at least one of: --from-literal, --from-file, --from-env-file'
        }
      }
      if (createSecretType === 'tls') {
        const certFlag = flags.cert
        const keyFlag = flags.key
        if (typeof certFlag !== 'string' || certFlag.trim().length === 0) {
          return 'create secret tls requires flag --cert'
        }
        if (typeof keyFlag !== 'string' || keyFlag.trim().length === 0) {
          return 'create secret tls requires flag --key'
        }
      }
      if (createSecretType === 'docker-registry') {
        const dockerServerFlag = flags['docker-server']
        const dockerUsernameFlag = flags['docker-username']
        const dockerPasswordFlag = flags['docker-password']
        if (
          typeof dockerServerFlag !== 'string' ||
          dockerServerFlag.trim().length === 0
        ) {
          return 'create secret docker-registry requires flag --docker-server'
        }
        if (
          typeof dockerUsernameFlag !== 'string' ||
          dockerUsernameFlag.trim().length === 0
        ) {
          return 'create secret docker-registry requires flag --docker-username'
        }
        if (
          typeof dockerPasswordFlag !== 'string' ||
          dockerPasswordFlag.trim().length === 0
        ) {
          return 'create secret docker-registry requires flag --docker-password'
        }
      }
    }
  }
  if (action === 'diff') {
    const hasFilename =
      typeof flags['filename'] === 'string' || typeof flags['f'] === 'string'
    if (!hasFilename) {
      return 'diff requires one of -f or --filename'
    }
  }
  if (action === 'replace') {
    if (!hasFilename) {
      return 'replace requires one of -f or --filename'
    }
  }
  if (action === 'delete') {
    const gracePeriodFlag = flags['grace-period']
    if (gracePeriodFlag !== undefined) {
      if (typeof gracePeriodFlag !== 'string') {
        return 'error: flag --grace-period requires a numeric value'
      }
      const parsedGracePeriod = Number.parseInt(gracePeriodFlag, 10)
      if (Number.isNaN(parsedGracePeriod) || parsedGracePeriod < 0) {
        return `error: invalid --grace-period value: ${gracePeriodFlag}`
      }
    }
  }
  if (action === 'set') {
    if (tokens[2] !== 'image') {
      return 'set currently supports only the image subcommand'
    }
    if (!resource) {
      return 'set image requires a resource type'
    }
    if (!name) {
      return 'set image requires a resource name'
    }
    if (
      resource !== 'pods' &&
      resource !== 'deployments' &&
      resource !== 'replicasets' &&
      resource !== 'daemonsets'
    ) {
      return `set image does not support resource type "${resource}"`
    }

    const positionalTokens = getPositionalTokensAfterIndex(tokens, 3)
    const hasContainerAssignment = positionalTokens.some((token) =>
      isContainerImageAssignmentToken(token)
    )
    if (!hasContainerAssignment) {
      return 'set image requires at least one container=image assignment'
    }
  }

  if (action === 'patch') {
    const patchPayload = flags['patch']
    if (typeof patchPayload !== 'string' || patchPayload.length === 0) {
      return 'error: required flag(s) "patch" not set'
    }

    const patchType = flags['type']
    if (patchType !== undefined && patchType !== 'merge') {
      return 'error: --type must be "merge"'
    }
  }

  if (action === 'config-set-context') {
    const isCurrent = flags['current'] === true
    const namespace = flags['namespace']
    if (!isCurrent) {
      return 'config set-context currently supports only --current'
    }
    if (typeof namespace !== 'string' || namespace.length === 0) {
      return 'config set-context requires flag --namespace'
    }
  }

  if (action === 'rollout') {
    const rolloutSubcommand = tokens[2]
    const isValidRolloutSubcommand =
      rolloutSubcommand === 'status' ||
      rolloutSubcommand === 'history' ||
      rolloutSubcommand === 'restart' ||
      rolloutSubcommand === 'undo'
    if (!isValidRolloutSubcommand) {
      return `error: invalid subcommand for rollout: ${rolloutSubcommand ?? '<none>'}`
    }

    if (
      resource !== 'deployments' &&
      resource !== 'daemonsets' &&
      resource !== 'statefulsets'
    ) {
      return 'error: rollout supports only deployments, daemonsets, and statefulsets'
    }

    if (name == null || name.length === 0) {
      return 'rollout requires a resource name'
    }

    const revisionValue = flags.revision
    if (revisionValue !== undefined) {
      const parsedRevision = Number.parseInt(String(revisionValue), 10)
      if (Number.isNaN(parsedRevision) || parsedRevision <= 0) {
        return `error: invalid value "${String(revisionValue)}" for --revision: must be a positive integer`
      }
      if (rolloutSubcommand !== 'history' && rolloutSubcommand !== 'undo') {
        return 'error: --revision is only supported by rollout history and rollout undo'
      }
    }

    const timeoutValue = flags.timeout
    if (timeoutValue !== undefined && rolloutSubcommand !== 'status') {
      return 'error: --timeout is only supported by rollout status'
    }
    if (timeoutValue !== undefined) {
      const normalizedTimeout = String(timeoutValue).trim()
      const isDurationLike = /^[0-9]+(s|m|h)?$/.test(normalizedTimeout)
      if (!isDurationLike) {
        return `error: invalid value "${String(timeoutValue)}" for --timeout`
      }
    }

    const watchValue = flags.watch
    if (watchValue !== undefined && rolloutSubcommand !== 'status') {
      return 'error: --watch is only supported by rollout status'
    }
    if (watchValue !== undefined) {
      const normalizedWatch = String(watchValue)
      if (normalizedWatch !== 'true' && normalizedWatch !== 'false') {
        return 'error: --watch must be either true or false'
      }
    }
  }

  return undefined
}

const validateGetWatchSemantics = (
  action: Action,
  flags: Record<string, string | boolean>
): string | undefined => {
  if (action !== 'get') {
    return undefined
  }

  const hasWatch = flags['watch'] === true || flags['w'] === true
  const hasWatchOnly = flags['watch-only'] === true
  if (hasWatch && hasWatchOnly) {
    return '--watch and --watch-only are mutually exclusive'
  }

  return undefined
}

const validateGetRawSemantics = (
  action: Action,
  flags: Record<string, string | boolean>,
  tokens: string[]
): string | undefined => {
  if (action !== 'get') {
    return undefined
  }

  const rawPath = getRawPathFromFlags(flags)
  if (rawPath === undefined) {
    return undefined
  }

  if (hasPositionalArgsAfterGet(tokens)) {
    return 'arguments may not be passed when --raw is specified'
  }

  const hasWatch = flags['watch'] === true || flags['w'] === true
  const hasWatchOnly = flags['watch-only'] === true
  const hasSelector =
    typeof flags['selector'] === 'string' || typeof flags['l'] === 'string'
  if (hasWatch || hasWatchOnly || hasSelector) {
    return '--raw may not be specified with other flags that filter the server request or alter the output'
  }

  const hasOutput =
    typeof flags['output'] === 'string' || typeof flags['o'] === 'string'
  if (hasOutput) {
    return '--raw and --output are mutually exclusive'
  }

  if (!isValidRawPath(rawPath)) {
    return `--raw must be a valid URL path: invalid path "${rawPath}"`
  }

  return undefined
}

const hasPositionalArgsAfterGet = (tokens: string[]): boolean => {
  for (let index = 2; index < tokens.length; index++) {
    const token = tokens[index]
    if (token === '--') {
      break
    }
    if (token.startsWith('-')) {
      const flagName = getFlagName(token)
      if (FLAGS_REQUIRING_VALUES.includes(flagName) && !token.includes('=')) {
        index = index + 1
      }
      continue
    }
    return true
  }
  return false
}

const isValidRawPath = (rawPath: string): boolean => {
  if (!rawPath.startsWith('/')) {
    return false
  }
  try {
    const parsed = new URL(rawPath, 'https://kubernetes.local')
    return parsed.pathname.startsWith('/')
  } catch {
    return false
  }
}

const getPositionalTokensAfterIndex = (
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
      const flagName = getFlagName(token)
      if (FLAGS_REQUIRING_VALUES.includes(flagName) && !token.includes('=')) {
        index += 1
      }
      continue
    }
    positionalTokens.push(token)
  }
  return positionalTokens
}

const isContainerImageAssignmentToken = (token: string): boolean => {
  const separatorIndex = token.indexOf('=')
  if (separatorIndex <= 0) {
    return false
  }
  if (separatorIndex === token.length - 1) {
    return false
  }
  return true
}
