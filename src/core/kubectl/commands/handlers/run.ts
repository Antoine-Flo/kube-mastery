import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { EnvVar } from '../../../cluster/ressources/Pod'
import { createPod } from '../../../cluster/ressources/Pod'
import type { SimNetworkRuntime } from '../../../network/SimNetworkRuntime'
import type { SimTrafficPodIdentity } from '../../../network/TrafficEngine'
import type { ExecutionResult } from '../../../shared/result'
import {
  error,
  errorWithIO,
  success,
  successWithIO
} from '../../../shared/result'
import { validateMetadataNameByKind } from '../resourceCatalog'
import { kubectlUsageError } from '../usageError'
import type { ParsedCommand } from '../types'
import { buildDryRunResponse } from './create'
import { createResourceWithEvents } from '../resourceCatalog'
import { executeRuntimeAttachedCommand } from './internal/runtimeCommand'
import { err as ntErr, ok as ntOk, type Result as NtResult } from 'neverthrow'
import {
  buildRequiredFlagNotSetMessage,
  buildRequiresResourceNameMessage
} from '../shared/errorMessages'

const INTERACTIVE_SHELLS = new Set(['sh', 'bash', '/bin/sh', '/bin/bash'])

const buildEnterContainerDirective = (
  podName: string,
  containerName: string,
  namespace: string
): string => {
  return `ENTER_CONTAINER:${namespace}:${podName}:${containerName}`
}

const isInteractiveShellCommand = (command: string[]): boolean => {
  const commandHead = command[0]
  if (commandHead == null || !INTERACTIVE_SHELLS.has(commandHead)) {
    return false
  }
  return command[1] !== '-c'
}

const stripMatchingQuotes = (raw: string): string => {
  const trimmed = raw.trim()
  if (trimmed.length < 2) {
    return trimmed
  }
  const hasDoubleQuotes = trimmed.startsWith('"') && trimmed.endsWith('"')
  if (hasDoubleQuotes) {
    return trimmed.slice(1, -1).trim()
  }
  const hasSingleQuotes = trimmed.startsWith("'") && trimmed.endsWith("'")
  if (hasSingleQuotes) {
    return trimmed.slice(1, -1).trim()
  }
  return trimmed
}

const parseEnvVars = (runEnv: readonly string[]): NtResult<EnvVar[], string> => {
  const envVars: EnvVar[] = []
  for (const rawEnvValue of runEnv) {
    const envValue = stripMatchingQuotes(rawEnvValue)
    const equalsIndex = envValue.indexOf('=')
    if (equalsIndex <= 0 || equalsIndex === envValue.length - 1) {
      return ntErr(`error: invalid env: ${envValue}`)
    }
    const envName = envValue.slice(0, equalsIndex).trim()
    const envRawValue = envValue.slice(equalsIndex + 1).trim()
    if (envName.length === 0 || envRawValue.length === 0) {
      return ntErr(`error: invalid env: ${envValue}`)
    }
    envVars.push({
      name: envName,
      source: {
        type: 'value',
        value: envRawValue
      }
    })
  }
  return ntOk(envVars)
}

const validateDryRunFlag = (
  dryRunFlag: string | boolean | undefined
): NtResult<undefined, string> => {
  if (
    typeof dryRunFlag === 'string' &&
    dryRunFlag !== 'none' &&
    dryRunFlag !== 'server' &&
    dryRunFlag !== 'client'
  ) {
    return ntErr(
      `error: Invalid dry-run value (${dryRunFlag}). Must be "none", "server", or "client".`
    )
  }
  return ntOk(undefined)
}

const isRunDryRunRequested = (
  dryRunFlag: string | boolean | undefined
): boolean => {
  return dryRunFlag === 'client' || dryRunFlag === 'server'
}

const validateRunRestartPolicy = (
  runRestart: ParsedCommand['runRestart']
): NtResult<undefined, string> => {
  if (
    runRestart != null &&
    runRestart !== 'Always' &&
    runRestart !== 'OnFailure' &&
    runRestart !== 'Never'
  ) {
    return ntErr(
      kubectlUsageError('kubectl run', `invalid restart policy: ${runRestart}`)
    )
  }
  return ntOk(undefined)
}

const validateRunTtyFlags = (
  runTty: ParsedCommand['runTty'],
  runStdin: ParsedCommand['runStdin']
): NtResult<undefined, string> => {
  if (runTty === true && runStdin !== true) {
    return ntErr(
      kubectlUsageError(
        'kubectl run',
        '-i/--stdin is required for containers with -t/--tty=true'
      )
    )
  }
  return ntOk(undefined)
}

const validateRunDryRunAttachCompatibility = (
  dryRunFlag: string | boolean | undefined,
  isAttachLike: boolean
): NtResult<undefined, string> => {
  if (isRunDryRunRequested(dryRunFlag) && isAttachLike) {
    return ntErr(
      kubectlUsageError(
        'kubectl run',
        "--dry-run=[server|client] can't be used with attached containers options (--attach, --stdin, or --tty)"
      )
    )
  }
  return ntOk(undefined)
}

const validateRunImagePullPolicy = (
  imagePullPolicyValue: string | boolean | undefined
): NtResult<undefined, string> => {
  if (imagePullPolicyValue == null) {
    return ntOk(undefined)
  }
  if (typeof imagePullPolicyValue !== 'string') {
    return ntErr(
      kubectlUsageError(
        'kubectl run',
        `invalid image pull policy: ${String(imagePullPolicyValue)}`
      )
    )
  }
  if (
    imagePullPolicyValue === 'Always' ||
    imagePullPolicyValue === 'IfNotPresent' ||
    imagePullPolicyValue === 'Never'
  ) {
    return ntOk(undefined)
  }
  return ntErr(
    kubectlUsageError(
      'kubectl run',
      `invalid image pull policy: ${imagePullPolicyValue}`
    )
  )
}

const validateRunImageName = (image: string): NtResult<undefined, string> => {
  const imagePattern = /^[a-zA-Z0-9][a-zA-Z0-9._/:@-]*$/
  if (imagePattern.test(image)) {
    return ntOk(undefined)
  }
  return ntErr(`Invalid image name "${image}": invalid reference format`)
}

const resolveRunRestartPolicy = (parsed: ParsedCommand): 'Always' | 'OnFailure' | 'Never' => {
  if (parsed.runRestart != null) {
    return parsed.runRestart
  }
  if (parsed.runStdin === true) {
    return 'OnFailure'
  }
  return 'Always'
}

const resolveRunLabels = (
  podName: string,
  runLabels: ParsedCommand['runLabels']
): Record<string, string> => {
  if (runLabels != null && Object.keys(runLabels).length > 0) {
    return { ...runLabels }
  }
  return {
    run: podName
  }
}

const buildRunDryRunManifest = (
  podName: string,
  parsed: ParsedCommand,
  image: string,
  envVars: EnvVar[],
  namespace: string,
  runCommand?: string[],
  runArgs?: string[]
): Record<string, unknown> => {
  const restartPolicy = resolveRunRestartPolicy(parsed)
  const metadataLabels = resolveRunLabels(podName, parsed.runLabels)
  const includeNamespaceInDryRun =
    typeof parsed.flags.namespace === 'string' ||
    typeof parsed.flags.n === 'string'
  const env = envVars
    .map((envVar) => {
      if (envVar.source.type !== 'value') {
        return undefined
      }
      return {
        name: envVar.name,
        value: envVar.source.value
      }
    })
    .filter((entry): entry is { name: string; value: string } => entry != null)
  const containerSpec: Record<string, unknown> = {
    image,
    name: podName,
    resources: {}
  }

  if (parsed.runUseCommand && runCommand != null) {
    containerSpec['command'] = runCommand
  }
  if (!parsed.runUseCommand && runArgs != null) {
    containerSpec['args'] = runArgs
  }
  if (typeof parsed.port === 'number') {
    containerSpec['ports'] = [
      {
        containerPort: parsed.port
      }
    ]
  }
  if (env.length > 0) {
    containerSpec['env'] = env
  }

  const metadata: Record<string, unknown> = {
    labels: metadataLabels,
    name: podName
  }
  if (includeNamespaceInDryRun) {
    metadata['namespace'] = namespace
  }

  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata,
    spec: {
      containers: [containerSpec],
      dnsPolicy: 'ClusterFirst',
      restartPolicy
    },
    status: {}
  }
}

/**
 * Handle kubectl run command (minimal scope)
 * Creates a single Pod with one container and command from `--command -- ...`.
 */
export const handleRun = (
  apiServer: ApiServerFacade,
  parsed: ParsedCommand,
  networkRuntime?: SimNetworkRuntime
): ExecutionResult => {
  const image = parsed.runImage
  if (typeof image !== 'string' || image.length === 0) {
    return error(buildRequiredFlagNotSetMessage('image'))
  }

  const imageValidation = validateRunImageName(image)
  if (imageValidation.isErr()) {
    return error(imageValidation.error)
  }

  const podName = parsed.name
  if (typeof podName !== 'string' || podName.length === 0) {
    return error(buildRequiresResourceNameMessage('run', false))
  }
  const podNameValidation = validateMetadataNameByKind('Pod', podName)
  if (podNameValidation != null) {
    return podNameValidation
  }

  const runCommand = parsed.runCommand
  const runArgs = parsed.runArgs
  const runtimeNamespace = parsed.namespace || 'default'
  const isAttachLike =
    parsed.runStdin === true ||
    parsed.runTty === true ||
    parsed.flags.attach === true
  if (parsed.runRemove === true && !isAttachLike) {
    return error('error: --rm should only be used for attached containers')
  }

  const dryRunValidation = validateDryRunFlag(parsed.flags['dry-run'])
  if (dryRunValidation.isErr()) {
    return error(dryRunValidation.error)
  }
  const ttyValidation = validateRunTtyFlags(parsed.runTty, parsed.runStdin)
  if (ttyValidation.isErr()) {
    return error(ttyValidation.error)
  }
  const dryRunAttachValidation = validateRunDryRunAttachCompatibility(
    parsed.flags['dry-run'],
    isAttachLike
  )
  if (dryRunAttachValidation.isErr()) {
    return error(dryRunAttachValidation.error)
  }
  const imagePullPolicyValidation = validateRunImagePullPolicy(
    parsed.flags['image-pull-policy']
  )
  if (imagePullPolicyValidation.isErr()) {
    return error(imagePullPolicyValidation.error)
  }

  const restartValidation = validateRunRestartPolicy(parsed.runRestart)
  if (restartValidation.isErr()) {
    return error(restartValidation.error)
  }

  const envVarsResult = parseEnvVars(parsed.runEnv || [])
  if (envVarsResult.isErr()) {
    return error(envVarsResult.error)
  }
  const envVars = envVarsResult.value
  const runLabels = resolveRunLabels(podName, parsed.runLabels)

  const restartPolicy = resolveRunRestartPolicy(parsed)
  const pod = createPod({
    name: podName,
    namespace: runtimeNamespace,
    restartPolicy,
    labels: runLabels,
    containers: [
      {
        name: podName,
        image,
        ...(parsed.runUseCommand && runCommand && { command: runCommand }),
        ...(!parsed.runUseCommand && runArgs && { args: runArgs }),
        ...(typeof parsed.port === 'number' && {
          ports: [{ containerPort: parsed.port }]
        }),
        ...(envVars.length > 0 && { env: envVars })
      }
    ],
    phase: 'Pending'
  })

  if (isRunDryRunRequested(parsed.flags['dry-run'])) {
    const dryRunManifest = buildRunDryRunManifest(
      podName,
      parsed,
      image,
      envVars,
      runtimeNamespace,
      runCommand,
      runArgs
    )
    return buildDryRunResponse(dryRunManifest, parsed)
  }

  const commandToExecute = runCommand ?? runArgs
  const hasInlineCommand =
    commandToExecute != null && commandToExecute.length > 0 && isAttachLike
  if (hasInlineCommand) {
    if (isInteractiveShellCommand(commandToExecute)) {
      const createResult = apiServer.createResource(
        'Pod',
        pod,
        runtimeNamespace
      )
      if (!createResult.ok) {
        return createResult
      }
      return success(
        buildEnterContainerDirective(podName, podName, runtimeNamespace)
      )
    }

    const sourcePodForTraffic: SimTrafficPodIdentity = {
      name: podName,
      namespace: runtimeNamespace,
      labels: runLabels
    }
    const runtimeResult = executeRuntimeAttachedCommand(
      commandToExecute,
      runtimeNamespace,
      networkRuntime,
      sourcePodForTraffic
    )
    if (runtimeResult != null) {
      const createResult = apiServer.createResource(
        'Pod',
        pod,
        runtimeNamespace
      )
      if (!createResult.ok) {
        return createResult
      }

      if (parsed.runRemove === true) {
        const deleteResult = apiServer.deleteResource(
          'Pod',
          podName,
          runtimeNamespace,
          { gracePeriodSeconds: 0, force: true }
        )
        if (!deleteResult.ok) {
          return deleteResult
        }
        const finalizeResult = apiServer.finalizePodDeletion(
          podName,
          runtimeNamespace,
          { source: 'kubectl-run-rm' }
        )
        if (!finalizeResult.ok) {
          return finalizeResult
        }
        const deleteMessage = `pod "${podName}" deleted from ${runtimeNamespace} namespace`
        const outputSegments: string[] = []
        if (runtimeResult.stdout.length > 0) {
          outputSegments.push(runtimeResult.stdout)
        }
        outputSegments.push(deleteMessage)
        const stdout = outputSegments.join('\n\n')
        const stderr =
          runtimeResult.exitCode === 0
            ? ''
            : `pod ${runtimeNamespace}/${podName} terminated (Error)`
        const io = {
          stdout,
          stderr,
          exitCode: runtimeResult.exitCode
        }
        if (runtimeResult.exitCode === 0) {
          return successWithIO(stdout, io)
        }
        return errorWithIO(stderr, io)
      }

      const io = {
        stdout: runtimeResult.stdout,
        stderr: runtimeResult.stderr,
        exitCode: runtimeResult.exitCode
      }
      if (runtimeResult.exitCode === 0) {
        return successWithIO(runtimeResult.stdout, io)
      }
      const message =
        runtimeResult.stderr.length > 0
          ? runtimeResult.stderr
          : runtimeResult.stdout
      return errorWithIO(message, io)
    }
  }

  return createResourceWithEvents(pod, apiServer)
}
