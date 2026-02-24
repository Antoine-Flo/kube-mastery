import {
  checkFlags,
  extract,
  parseFlags,
  parseSelector,
  pipeResult,
  tokenize,
  trim
} from '../../shared/parsing'
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
  'delete',
  'apply',
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
  'run'
]

// Flag aliases: short form → long form
const FLAG_ALIASES: Record<string, string> = {
  n: 'namespace',
  o: 'output',
  l: 'selector',
  f: 'filename', // Note: -f is also used for --follow in logs, but filename takes precedence
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
  'api-version'
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
  'diff'
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

  return success({
    action: ctx.action,
    resource: ctx.resource, // May be undefined for commands like 'version'
    rawPath: getRawPathFromFlags(normalizedFlags),
    name: ctx.name,
    namespace: getNamespaceFromFlags(normalizedFlags),
    output: getOutputFromFlags(normalizedFlags),
    selector: getSelectorFromFlags(normalizedFlags),
    flags: ctx.flags,
    execCommand: ctx.execCommand,
    createImages: ctx.createImages,
    createCommand: ctx.createCommand,
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
    explainPath: ctx.explainPath,
    labelChanges: ctx.labelChanges,
    annotationChanges: ctx.annotationChanges,
    replicas: getReplicasFromFlags(normalizedFlags),
    port: getPortFromFlags(normalizedFlags)
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

  // Actions with custom transformers parse name differently
  const actionsWithCustomParsing = [
    'exec',
    'logs',
    'apply',
    'label',
    'annotate',
    'explain',
    'run'
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
      ctx.runCommand,
      ctx.runArgs,
      ctx.runHasSeparator
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
      ctx.runCommand,
      ctx.runArgs,
      ctx.runHasSeparator
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
    ctx.runCommand,
    ctx.runArgs,
    ctx.runHasSeparator
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
): Record<string, string> | undefined => {
  const selector = flags['selector']

  if (typeof selector === 'string') {
    return parseSelector(selector)
  }

  return undefined
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

// ─── Validation ──────────────────────────────────────────────────────────

/**
 * Validate command semantics (fail fast)
 * Returns error message if invalid, undefined if valid
 */
const validateCommandSemantics = (
  action: Action,
  _resource: Resource | undefined,
  name?: string,
  flags: Record<string, string | boolean> = {},
  tokens: string[] = [],
  runCommand?: string[],
  runArgs?: string[],
  runHasSeparator?: boolean
): string | undefined => {
  const rawValidationError = validateGetRawSemantics(action, flags, tokens)
  if (rawValidationError !== undefined) {
    return rawValidationError
  }

  if (
    (action === 'delete' ||
      action === 'describe' ||
      action === 'logs' ||
      action === 'exec' ||
      action === 'label' ||
      action === 'annotate' ||
      action === 'scale' ||
      action === 'run') &&
    !name
  ) {
    return `${action} requires a resource name`
  }
  if (action === 'run') {
    const runImage = flags['image']
    if (typeof runImage !== 'string' || runImage.length === 0) {
      return 'run requires flag --image'
    }

    const runUsesCommand = flags['command'] === true
    if (runUsesCommand && (!runCommand || runCommand.length === 0)) {
      return 'run requires command after --'
    }

    if (
      runHasSeparator &&
      !runUsesCommand &&
      (!runArgs || runArgs.length === 0)
    ) {
      return 'run requires arguments after --'
    }

    const dryRunFlag = flags['dry-run']
    if (
      dryRunFlag !== undefined &&
      dryRunFlag !== 'client' &&
      dryRunFlag !== 'server' &&
      dryRunFlag !== 'none'
    ) {
      return 'run dry-run must be one of: none, server, client'
    }

    const restartFlag = flags['restart']
    if (
      restartFlag !== undefined &&
      restartFlag !== 'Always' &&
      restartFlag !== 'OnFailure' &&
      restartFlag !== 'Never'
    ) {
      return 'run restart must be one of: Always, OnFailure, Never'
    }
  }
  if (action === 'diff') {
    const hasFilename =
      typeof flags['filename'] === 'string' || typeof flags['f'] === 'string'
    if (!hasFilename) {
      return 'diff requires one of -f or --filename'
    }
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
