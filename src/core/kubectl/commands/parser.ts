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
import {
  error,
  fromNeverthrowResult,
  success,
  toNeverthrowResult
} from '../../shared/result'
import { err as ntErr, ok as ntOk, type Result as NtResult } from 'neverthrow'
import { parseResourceTargetToken } from './resourceCatalog'
import {
  AUTH_SUBCOMMAND_ACTIONS,
  CONFIG_SUBCOMMAND_ACTIONS
} from './actionGroups'
import { getTransformerForAction, type ParseContext } from './transformers'
import type { Action, ParsedCommand, Resource } from './types'
import { assertParsedCommandSupportedBySpec } from '../cli/runtime/parse'
import { applyKubectlCliAliases } from '../cli/runtime/tokenize'
import { validateUnknownFlagsBySpec } from '../cli/runtime/flagErrors'
import { validateUnknownCommandBySpec } from '../cli/runtime/commandErrors'
import { KUBECTL_ROOT_COMMAND_SPEC } from '../cli/registry/root'
import type { KubectlCommandSpec } from '../cli/model'
import {
  buildRequiredFlagNotSetMessage,
  buildRequiresFilenameFlagMessage
} from './shared/errorMessages'

// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL COMMAND PARSER
// ═══════════════════════════════════════════════════════════════════════════
// Parses kubectl command strings with resource aliases and namespace flags.
// Supports all kubectl actions (get, describe, delete, apply, create).
//
// Flag vocabulary is driven by KUBECTL_ROOT_COMMAND_SPEC (src/core/kubectl/cli/registry/root.ts).
// For parity work, map spec entries to upstream *Flags types under refs/k8s/kubectl/pkg/cmd/<cmd>/.
//
// Uses Railway-oriented programming (pipeResult) for clean pipeline composition.
// Each step transforms a ParseContext and can fail, stopping the pipeline.

// ─── Constants ───────────────────────────────────────────────────────────

const walkCommandSpecs = (
  commandSpec: KubectlCommandSpec,
  visit: (command: KubectlCommandSpec) => void
): void => {
  visit(commandSpec)
  for (const child of commandSpec.subcommands) {
    walkCommandSpecs(child, visit)
  }
}

const getTopLevelActionsFromSpec = (): Action[] => {
  const actions = KUBECTL_ROOT_COMMAND_SPEC.subcommands.map((commandSpec) => {
    return commandSpec.path[commandSpec.path.length - 1]
  })
  return actions as Action[]
}

const buildFlagParsingSpec = (): {
  aliases: Record<string, string>
  requiringValues: string[]
  requiringValuesSet: Set<string>
} => {
  const flagsWithOptionalValues = new Set(['watch'])
  const forcedShortValueFlags = new Set(['p'])
  const preferredShortAliases: Record<string, string> = {
    p: 'patch'
  }
  const aliases: Record<string, string> = {}
  const longFlagsRequiringValues = new Set<string>()
  const shortBooleanFlags = new Set<string>()
  const shortNonBooleanFlags = new Set<string>()

  walkCommandSpecs(KUBECTL_ROOT_COMMAND_SPEC, (commandSpec) => {
    for (const flagSpec of commandSpec.flags) {
      const isBooleanFlag = flagSpec.kind === 'boolean'
      if (!isBooleanFlag && !flagsWithOptionalValues.has(flagSpec.name)) {
        longFlagsRequiringValues.add(flagSpec.name)
      }

      if (flagSpec.short == null) {
        continue
      }

      if (aliases[flagSpec.short] == null) {
        aliases[flagSpec.short] = flagSpec.name
      }

      if (isBooleanFlag) {
        shortBooleanFlags.add(flagSpec.short)
      } else {
        shortNonBooleanFlags.add(flagSpec.short)
      }
    }
  })

  const shortFlagsRequiringValues = [...shortNonBooleanFlags].filter(
    (shortFlag) => {
      return !shortBooleanFlags.has(shortFlag)
    }
  )
  for (const forcedShortFlag of forcedShortValueFlags) {
    shortFlagsRequiringValues.push(forcedShortFlag)
  }

  for (const [shortAlias, longAlias] of Object.entries(preferredShortAliases)) {
    aliases[shortAlias] = longAlias
  }

  const requiringValues = [
    ...longFlagsRequiringValues,
    ...shortFlagsRequiringValues
  ]

  return {
    aliases,
    requiringValues,
    requiringValuesSet: new Set(requiringValues)
  }
}

const VALID_ACTIONS: Action[] = getTopLevelActionsFromSpec()
const FLAG_PARSING_SPEC = buildFlagParsingSpec()
const FLAG_ALIASES: Record<string, string> = FLAG_PARSING_SPEC.aliases
const FLAGS_REQUIRING_VALUES: string[] = FLAG_PARSING_SPEC.requiringValues
const FLAGS_REQUIRING_VALUES_SET = FLAG_PARSING_SPEC.requiringValuesSet

// Output formats for kubectl commands
type OutputFormat = 'table' | 'yaml' | 'json'
const VALID_OUTPUT_FORMATS = new Set<OutputFormat>(['table', 'yaml', 'json'])

const ACTIONS_WITHOUT_RESOURCE: Action[] = [
  'version',
  'cluster-info',
  'api-versions',
  'api-resources',
  'options',
  'diff',
  'replace',
  'set',
  'top-pods',
  'top-nodes',
  ...CONFIG_SUBCOMMAND_ACTIONS,
  ...AUTH_SUBCOMMAND_ACTIONS,
  'create-token'
]

// ─── Main Parsing Pipeline ──────────────────────────────────────────────

/**
 * Main entry point for parsing kubectl commands
 *
 * Pipeline: validate input → tokenize → validate kubectl → extract action →
 *           apply action-specific transform → parse flags → extract resource/name → validate
 */
export const parseCommand = (input: string): Result<ParsedCommand> => {
  const genericPipeline = pipeResult<ParseContext>(
    trim,
    tokenize,
    checkKubectl,
    extract(1, VALID_ACTIONS, 'action', 'Invalid or missing action')
  )
  const commandPipeline = pipeResult<ParseContext>(
    parseFlags(1, FLAG_ALIASES, FLAGS_REQUIRING_VALUES),
    checkFlags(FLAGS_REQUIRING_VALUES),
    extractResource,
    extractName,
    checkSemantics,
    build
  )

  const parseResult = toNeverthrowResult(validateUnknownCommandBySpec(input))
    .andThen(() => {
      return toNeverthrowResult(validateUnknownFlagsBySpec(input))
    })
    .andThen(() => {
      return toNeverthrowResult(genericPipeline({ input }))
    })
    .andThen((genericContext) => {
      const transformer = getTransformerForAction(genericContext.action)
      return toNeverthrowResult(transformer(genericContext))
    })
    .andThen((transformedContext) => {
      return toNeverthrowResult(commandPipeline(transformedContext))
    })
    .andThen((ctx) => {
      const parsedCommandResult = buildParsedCommandFromContext(ctx)
      if (parsedCommandResult.isErr()) {
        return parsedCommandResult
      }
      const parsedCommand = parsedCommandResult.value
      const supportResult = assertParsedCommandSupportedBySpec(input, parsedCommand)
      if (!supportResult.ok) {
        return ntErr(supportResult.error)
      }

      return ntOk(parsedCommand)
    })

  return fromNeverthrowResult(parseResult)
}

// ─── Pipeline Steps ──────────────────────────────────────────────────────
// Each step: ParseContext → Result<ParseContext>

const checkKubectl = (ctx: ParseContext): Result<ParseContext> => {
  if (!ctx.tokens || ctx.tokens.length === 0) {
    return error('Command must start with kubectl')
  }
  const tokens = [...ctx.tokens]
  applyKubectlCliAliases(tokens)
  if (tokens[0] !== 'kubectl') {
    return error('Command must start with kubectl')
  }
  return success({ ...ctx, tokens })
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

  const parsedTarget = parseResourceTargetToken(resourceCandidate.token)
  if (!parsedTarget.ok) {
    return parsedTarget
  }

  return success({
    ...ctx,
    resource: parsedTarget.value.resource,
    name: parsedTarget.value.name,
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
      if (FLAGS_REQUIRING_VALUES_SET.has(flagName) && !token.includes('=')) {
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

  const normalizedFlags = ctx.normalizedFlags || ctx.flags || {}
  const tokens = ctx.tokens || []
  const validateSemantics = (): Result<ParseContext> => {
    const validationError = validateCommandSemantics(
      ctx.action as Action,
      ctx.resource,
      ctx.name,
      normalizedFlags,
      tokens,
      ctx.createServiceType,
      ctx.createSecretType
    )
    if (validationError != null) {
      return error(validationError)
    }
    return success(ctx)
  }

  // Commands like 'version', 'cluster-info', 'api-versions', 'api-resources' and 'diff' don't require a resource
  if (ACTIONS_WITHOUT_RESOURCE.includes(ctx.action)) {
    return validateSemantics()
  }

  const rawPath = getRawPathFromFlags(normalizedFlags)
  if (ctx.action === 'get' && typeof rawPath === 'string') {
    return validateSemantics()
  }

  if (!ctx.resource) {
    return error('Missing resource')
  }

  return validateSemantics()
}

const buildParsedCommandFromContext = (
  ctx: ParseContext
): NtResult<ParsedCommand, string> => {
  if (!ctx.action || !ctx.flags) {
    return ntErr('Internal parsing error: incomplete context')
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
    return ntErr(parsedSelector.error)
  }

  return ntOk({
    action: ctx.action,
    configSubcommand: ctx.configSubcommand,
    resource: ctx.resource,
    resourceList: ctx.resourceList,
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
    createIngressClassName: ctx.createIngressClassName,
    createIngressRules: ctx.createIngressRules,
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
    configContextName: ctx.configContextName,
    configRenameContextTo: ctx.configRenameContextTo,
    configPath: ctx.configPath,
    configUserName: ctx.configUserName,
    configClusterName: ctx.configClusterName,
    configServer: getConfigServerFromFlags(normalizedFlags),
    configToken: getConfigTokenFromFlags(normalizedFlags),
    authVerb: ctx.authVerb,
    authResource: ctx.authResource,
    authSubject: getAuthSubjectFromFlags(normalizedFlags),
    explainPath: ctx.explainPath,
    labelChanges: ctx.labelChanges,
    annotationChanges: ctx.annotationChanges,
    replicas: getReplicasFromFlags(normalizedFlags),
    port: getPortFromFlags(normalizedFlags),
    waitForCondition: ctx.waitForCondition,
    waitTimeoutSeconds: ctx.waitTimeoutSeconds,
    patchPayload: getPatchPayloadFromFlags(normalizedFlags),
    patchType: getPatchTypeFromFlags(normalizedFlags),
    deleteGracePeriodSeconds: getDeleteGracePeriodSecondsFromFlags(normalizedFlags),
    deleteForce: getDeleteForceFromFlags(normalizedFlags)
  })
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
  const resourceToken = tokens[resourceTokenIndex]
  if (resourceToken != null && resourceToken.includes('/')) {
    const [, inlineName] = resourceToken.split('/', 2)
    if (inlineName != null && inlineName.length > 0) {
      names.push(inlineName)
    }
  }
  for (let index = resourceTokenIndex + 1; index < tokens.length; index++) {
    const token = tokens[index]
    if (token === '--') {
      break
    }
    if (token.startsWith('-')) {
      const flagName = getFlagName(token)
      if (FLAGS_REQUIRING_VALUES_SET.has(flagName) && !token.includes('=')) {
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

const getConfigServerFromFlags = (
  flags: Record<string, string | boolean>
): string | undefined => {
  const server = flags.server
  if (typeof server === 'string') {
    return server
  }
  return undefined
}

const getConfigTokenFromFlags = (
  flags: Record<string, string | boolean>
): string | undefined => {
  const token = flags.token
  if (typeof token === 'string') {
    return token
  }
  return undefined
}

const getAuthSubjectFromFlags = (
  flags: Record<string, string | boolean>
): string | undefined => {
  const subject = flags.as
  if (typeof subject === 'string') {
    return subject
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

type CreateSemanticContext = {
  resource: Resource | undefined
  name?: string
  flags: Record<string, string | boolean>
  createServiceType?: 'clusterip' | 'nodeport' | 'loadbalancer' | 'externalname'
  createSecretType?: 'generic' | 'tls' | 'docker-registry'
}

type CreateSemanticValidator = (
  context: CreateSemanticContext
) => string | undefined

const hasNonEmptyStringFlag = (
  flags: Record<string, string | boolean>,
  flagName: string
): boolean => {
  const value = flags[flagName]
  if (typeof value !== 'string') {
    return false
  }
  return value.trim().length > 0
}

const validateCreateServiceSemantics: CreateSemanticValidator = (context) => {
  const { createServiceType, name, flags } = context
  if (createServiceType == null) {
    return 'create service requires one of: clusterip, nodeport, loadbalancer, externalname'
  }
  if (name == null || name.length === 0) {
    return 'create service requires a service name'
  }
  const hasTcp = hasNonEmptyStringFlag(flags, 'tcp')
  const hasExternalName = hasNonEmptyStringFlag(flags, 'external-name')
  if (createServiceType === 'externalname') {
    if (!hasExternalName) {
      return 'create service externalname requires flag --external-name'
    }
    if (hasTcp) {
      return 'create service externalname does not support flag --tcp'
    }
    return undefined
  }
  if (!hasTcp) {
    return 'create service requires flag --tcp'
  }
  if (hasExternalName) {
    return `create service ${createServiceType} does not support flag --external-name`
  }
  return undefined
}

const validateCreateConfigMapSemantics: CreateSemanticValidator = (context) => {
  const { name, flags } = context
  if (name == null || name.length === 0) {
    return 'create configmap requires a name'
  }
  if (!hasNonEmptyStringFlag(flags, 'from-literal')) {
    return 'create configmap requires at least one --from-literal=key=value'
  }
  return undefined
}

const validateCreateRoleSemantics: CreateSemanticValidator = (context) => {
  const { resource, name, flags } = context
  const kind = resource === 'roles' ? 'role' : 'clusterrole'
  if (name == null || name.length === 0) {
    return `create ${kind} requires a name`
  }
  if (!hasNonEmptyStringFlag(flags, 'verb')) {
    return `create ${kind} requires flag --verb`
  }
  if (!hasNonEmptyStringFlag(flags, 'resource')) {
    return `create ${kind} requires flag --resource`
  }
  return undefined
}

const validateServiceAccountSubject = (
  subjectValue: string,
  baseCommandName: string
): string | undefined => {
  if (!subjectValue.includes(':')) {
    return `${baseCommandName} --serviceaccount must be namespace:name`
  }
  return undefined
}

const validateCreateRoleBindingSemantics: CreateSemanticValidator = (context) => {
  const { name, flags } = context
  if (name == null || name.length === 0) {
    return 'create rolebinding requires a name'
  }
  if (!hasNonEmptyStringFlag(flags, 'role')) {
    return 'create rolebinding requires flag --role'
  }
  const serviceAccount = flags.serviceaccount
  if (typeof serviceAccount !== 'string' || serviceAccount.trim().length === 0) {
    return 'create rolebinding requires flag --serviceaccount'
  }
  return validateServiceAccountSubject(serviceAccount, 'create rolebinding')
}

const validateCreateClusterRoleBindingSemantics: CreateSemanticValidator = (
  context
) => {
  const { name, flags } = context
  if (name == null || name.length === 0) {
    return 'create clusterrolebinding requires a name'
  }
  if (!hasNonEmptyStringFlag(flags, 'clusterrole')) {
    return 'create clusterrolebinding requires flag --clusterrole'
  }
  const serviceAccount = flags.serviceaccount
  if (typeof serviceAccount !== 'string' || serviceAccount.trim().length === 0) {
    return 'create clusterrolebinding requires flag --serviceaccount'
  }
  return validateServiceAccountSubject(
    serviceAccount,
    'create clusterrolebinding'
  )
}

const validateCreateIngressSemantics: CreateSemanticValidator = (context) => {
  const { name, flags } = context
  if (name == null || name.length === 0) {
    return 'create ingress requires an ingress name'
  }
  if (!hasNonEmptyStringFlag(flags, 'rule')) {
    return 'create ingress requires at least one --rule'
  }
  return undefined
}

const validateCreateSecretSemantics: CreateSemanticValidator = (context) => {
  const { createSecretType, name, flags } = context
  if (createSecretType == null) {
    return 'create secret requires one of: generic, tls, docker-registry'
  }
  if (name == null || name.length === 0) {
    return 'create secret requires a name'
  }
  if (createSecretType === 'generic') {
    const hasGenericSource =
      flags['from-literal'] !== undefined ||
      flags['from-file'] !== undefined ||
      flags['from-env-file'] !== undefined
    if (!hasGenericSource) {
      return 'create secret generic requires at least one of: --from-literal, --from-file, --from-env-file'
    }
    return undefined
  }
  if (createSecretType === 'tls') {
    if (!hasNonEmptyStringFlag(flags, 'cert')) {
      return 'create secret tls requires flag --cert'
    }
    if (!hasNonEmptyStringFlag(flags, 'key')) {
      return 'create secret tls requires flag --key'
    }
    return undefined
  }
  if (!hasNonEmptyStringFlag(flags, 'docker-server')) {
    return 'create secret docker-registry requires flag --docker-server'
  }
  if (!hasNonEmptyStringFlag(flags, 'docker-username')) {
    return 'create secret docker-registry requires flag --docker-username'
  }
  if (!hasNonEmptyStringFlag(flags, 'docker-password')) {
    return 'create secret docker-registry requires flag --docker-password'
  }
  return undefined
}

const CREATE_SEMANTIC_VALIDATORS: Partial<
  Record<Resource, CreateSemanticValidator>
> = {
  services: validateCreateServiceSemantics,
  configmaps: validateCreateConfigMapSemantics,
  roles: validateCreateRoleSemantics,
  clusterroles: validateCreateRoleSemantics,
  rolebindings: validateCreateRoleBindingSemantics,
  clusterrolebindings: validateCreateClusterRoleBindingSemantics,
  ingresses: validateCreateIngressSemantics,
  secrets: validateCreateSecretSemantics
}

const validateCreateSemantics = (
  context: CreateSemanticContext
): string | undefined => {
  const { resource } = context
  if (resource == null) {
    return undefined
  }
  const validator = CREATE_SEMANTIC_VALIDATORS[resource]
  if (validator == null) {
    return undefined
  }
  return validator(context)
}

type SemanticValidationContext = {
  action: Action
  resource: Resource | undefined
  name?: string
  flags: Record<string, string | boolean>
  tokens: string[]
  hasFilename: boolean
  createServiceType?:
    | 'clusterip'
    | 'nodeport'
    | 'loadbalancer'
    | 'externalname'
  createSecretType?: 'generic' | 'tls' | 'docker-registry'
}

type ActionSemanticValidator = (
  context: SemanticValidationContext
) => string | undefined

const validateDryRunValue = (
  value: string | boolean | undefined
): string | undefined => {
  if (
    value !== undefined &&
    value !== 'client' &&
    value !== 'server' &&
    value !== 'none'
  ) {
    return `error: Invalid dry-run value (${String(value)}). Must be "none", "server", or "client".`
  }
  return undefined
}

const validateRunSemantics: ActionSemanticValidator = (context) => {
  const { name, flags } = context
  const runImage = flags['image']
  if (typeof runImage !== 'string' || runImage.length === 0) {
    return buildRequiredFlagNotSetMessage('image')
  }
  if (name == null || name.length === 0) {
    return 'run requires a resource name'
  }
  const dryRunError = validateDryRunValue(flags['dry-run'])
  if (dryRunError !== undefined) {
    return dryRunError
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
  return undefined
}

const validateCreateActionSemantics: ActionSemanticValidator = (context) => {
  const dryRunError = validateDryRunValue(context.flags['dry-run'])
  if (dryRunError !== undefined) {
    return dryRunError
  }
  return validateCreateSemantics({
    resource: context.resource,
    name: context.name,
    flags: context.flags,
    createServiceType: context.createServiceType,
    createSecretType: context.createSecretType
  })
}

const validateExposeSemantics: ActionSemanticValidator = (context) => {
  return validateDryRunValue(context.flags['dry-run'])
}

const validateDiffSemantics: ActionSemanticValidator = (context) => {
  if (!context.hasFilename) {
    return buildRequiresFilenameFlagMessage('diff')
  }
  return undefined
}

const validateReplaceSemantics: ActionSemanticValidator = (context) => {
  if (!context.hasFilename) {
    return buildRequiresFilenameFlagMessage('replace')
  }
  return undefined
}

const validateDeleteSemantics: ActionSemanticValidator = (context) => {
  const gracePeriodFlag = context.flags['grace-period']
  if (gracePeriodFlag === undefined) {
    return undefined
  }
  if (typeof gracePeriodFlag !== 'string') {
    return 'error: flag --grace-period requires a numeric value'
  }
  const parsedGracePeriod = Number.parseInt(gracePeriodFlag, 10)
  if (Number.isNaN(parsedGracePeriod) || parsedGracePeriod < 0) {
    return `error: invalid --grace-period value: ${gracePeriodFlag}`
  }
  return undefined
}

const validateSetSemantics: ActionSemanticValidator = (context) => {
  const { resource, name, tokens } = context
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
  const hasContainerAssignment = positionalTokens.some((token) => {
    return isContainerImageAssignmentToken(token)
  })
  if (!hasContainerAssignment) {
    return 'set image requires at least one container=image assignment'
  }
  return undefined
}

const validatePatchSemantics: ActionSemanticValidator = (context) => {
  const patchPayload = context.flags['patch']
  if (typeof patchPayload !== 'string' || patchPayload.length === 0) {
    return buildRequiredFlagNotSetMessage('patch')
  }
  const patchType = context.flags['type']
  if (patchType !== undefined && patchType !== 'merge') {
    return 'error: --type must be "merge"'
  }
  return undefined
}

const validateConfigSetContextSemantics: ActionSemanticValidator = (context) => {
  const isCurrent = context.flags['current'] === true
  const namespace = context.flags['namespace']
  if (!isCurrent) {
    return 'config set-context currently supports only --current'
  }
  if (typeof namespace !== 'string' || namespace.length === 0) {
    return 'config set-context requires flag --namespace'
  }
  return undefined
}

const validateConfigUseContextSemantics: ActionSemanticValidator = (context) => {
  if (context.name == null || context.name.length === 0) {
    return 'config use-context requires a context name'
  }
  return undefined
}

const validateConfigSetCredentialsSemantics: ActionSemanticValidator = (
  context
) => {
  if (context.name == null || context.name.length === 0) {
    return 'config set-credentials requires a user name'
  }
  if (typeof context.flags.token !== 'string' || context.flags.token.length === 0) {
    return 'config set-credentials requires flag --token'
  }
  return undefined
}

const validateConfigSetClusterSemantics: ActionSemanticValidator = (context) => {
  if (context.name == null || context.name.length === 0) {
    return 'config set-cluster requires a cluster name'
  }
  if (
    typeof context.flags.server !== 'string' ||
    context.flags.server.length === 0
  ) {
    return 'config set-cluster requires flag --server'
  }
  return undefined
}

const validateConfigUnsetSemantics: ActionSemanticValidator = (context) => {
  if (context.name == null || context.name.length === 0) {
    return 'config unset requires a property path'
  }
  return undefined
}

const validateConfigRenameContextSemantics: ActionSemanticValidator = (
  context
) => {
  const positionalTokens = getPositionalTokensAfterIndex(context.tokens, 3)
  if (positionalTokens.length < 2) {
    return 'config rename-context requires <old-name> <new-name>'
  }
  return undefined
}

const validateAuthCanISemantics: ActionSemanticValidator = (context) => {
  const positionalTokens = getPositionalTokensAfterIndex(context.tokens, 3)
  if (positionalTokens.length < 2) {
    return 'auth can-i requires <verb> <resource>'
  }
  return undefined
}

const validateAuthReconcileSemantics: ActionSemanticValidator = (context) => {
  if (!context.hasFilename) {
    return buildRequiresFilenameFlagMessage('auth reconcile')
  }
  return undefined
}

const validateCreateTokenSemantics: ActionSemanticValidator = (context) => {
  if (context.name == null || context.name.length === 0) {
    return 'create token requires a serviceaccount name'
  }
  return undefined
}

const validateRolloutSemantics: ActionSemanticValidator = (context) => {
  const { resource, name, flags, tokens } = context
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
  const toRevisionValue = flags['to-revision']
  if (
    revisionValue !== undefined &&
    toRevisionValue !== undefined &&
    String(revisionValue) !== String(toRevisionValue)
  ) {
    return 'error: --revision and --to-revision must target the same value'
  }
  const effectiveRevisionValue = revisionValue ?? toRevisionValue
  if (effectiveRevisionValue !== undefined) {
    const parsedRevision = Number.parseInt(String(effectiveRevisionValue), 10)
    if (Number.isNaN(parsedRevision) || parsedRevision <= 0) {
      return `error: invalid value "${String(effectiveRevisionValue)}" for --revision: must be a positive integer`
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
  return undefined
}

const validateTopSemantics: ActionSemanticValidator = (context) => {
  if (context.flags['output'] !== undefined) {
    return 'error: --output is not supported by top'
  }
  return undefined
}

const ACTION_SEMANTIC_VALIDATORS: Partial<
  Record<Action, ActionSemanticValidator>
> = {
  run: validateRunSemantics,
  create: validateCreateActionSemantics,
  expose: validateExposeSemantics,
  diff: validateDiffSemantics,
  replace: validateReplaceSemantics,
  delete: validateDeleteSemantics,
  set: validateSetSemantics,
  patch: validatePatchSemantics,
  'config-set-context': validateConfigSetContextSemantics,
  'config-use-context': validateConfigUseContextSemantics,
  'config-set-credentials': validateConfigSetCredentialsSemantics,
  'config-set-cluster': validateConfigSetClusterSemantics,
  'config-unset': validateConfigUnsetSemantics,
  'config-rename-context': validateConfigRenameContextSemantics,
  'auth-can-i': validateAuthCanISemantics,
  'auth-reconcile': validateAuthReconcileSemantics,
  'create-token': validateCreateTokenSemantics,
  rollout: validateRolloutSemantics,
  'top-pods': validateTopSemantics,
  'top-nodes': validateTopSemantics
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
    action === 'edit' ||
    (action === 'logs' && !hasSelector) ||
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
  const canDescribeWithoutName =
    action === 'describe' && (resource === 'nodes' || resource === 'events')
  if (
    action === 'describe' &&
    !name &&
    !hasSelector &&
    !canDescribeWithoutName
  ) {
    return 'describe requires a resource name'
  }
  const actionValidator = ACTION_SEMANTIC_VALIDATORS[action]
  if (actionValidator != null) {
    const actionValidationError = actionValidator({
      action,
      resource,
      name,
      flags,
      tokens,
      hasFilename,
      createServiceType,
      createSecretType
    })
    if (actionValidationError !== undefined) {
      return actionValidationError
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
      if (FLAGS_REQUIRING_VALUES_SET.has(flagName) && !token.includes('=')) {
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
      if (FLAGS_REQUIRING_VALUES_SET.has(flagName) && !token.includes('=')) {
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
