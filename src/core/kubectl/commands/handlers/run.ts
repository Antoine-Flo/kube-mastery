import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { EnvVar } from '../../../cluster/ressources/Pod'
import { createPod } from '../../../cluster/ressources/Pod'
import type { SimNetworkRuntime } from '../../../network/SimNetworkRuntime'
import type { SimTrafficPodIdentity } from '../../../network/TrafficEngine'
import type { ExecutionResult } from '../../../shared/result'
import {
  error,
  errorWithIO,
  successWithIO
} from '../../../shared/result'
import { validateMetadataNameByKind } from '../metadataNameValidation'
import type { ParsedCommand } from '../types'
import { buildDryRunResponse } from './create'
import { createResourceWithEvents } from '../resourceHelpers'
import { executeRuntimeAttachedCommand } from './internal/runtimeCommand'

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

const buildRunDryRunManifest = (
  podName: string,
  parsed: ParsedCommand,
  image: string,
  envVars: EnvVar[],
  runCommand?: string[],
  runArgs?: string[]
): Record<string, unknown> => {
  const restartPolicy = parsed.runRestart ?? 'Always'
  const metadataLabels = {
    run: podName,
    ...(parsed.runLabels ?? {})
  }
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

  return {
    apiVersion: 'v1',
    kind: 'Pod',
    metadata: {
      labels: metadataLabels,
      name: podName
    },
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
    return error('error: required flag(s) "image" not set')
  }

  const podName = parsed.name
  if (typeof podName !== 'string' || podName.length === 0) {
    return error('run requires a resource name')
  }
  const podNameValidation = validateMetadataNameByKind('Pod', podName)
  if (podNameValidation != null) {
    return podNameValidation
  }

  const dryRunFlag = parsed.flags['dry-run']
  if (
    typeof dryRunFlag === 'string' &&
    dryRunFlag !== 'none' &&
    dryRunFlag !== 'server' &&
    dryRunFlag !== 'client'
  ) {
    return error(
      `error: Invalid dry-run value (${dryRunFlag}). Must be "none", "server", or "client".`
    )
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
  if (
    parsed.runRestart != null &&
    parsed.runRestart !== 'Always' &&
    parsed.runRestart !== 'OnFailure' &&
    parsed.runRestart !== 'Never'
  ) {
    return error(
      `error: invalid restart policy: ${parsed.runRestart}\nSee 'kubectl run -h' for help and examples`
    )
  }

  const envVars: EnvVar[] = []
  const runEnv = parsed.runEnv || []
  for (const rawEnvValue of runEnv) {
    const envValue = stripMatchingQuotes(rawEnvValue)
    const equalsIndex = envValue.indexOf('=')
    if (equalsIndex <= 0 || equalsIndex === envValue.length - 1) {
      return error(`error: invalid env: ${envValue}`)
    }
    const envName = envValue.slice(0, equalsIndex).trim()
    const envRawValue = envValue.slice(equalsIndex + 1).trim()
    if (envName.length === 0 || envRawValue.length === 0) {
      return error(`error: invalid env: ${envValue}`)
    }
    envVars.push({
      name: envName,
      source: {
        type: 'value',
        value: envRawValue
      }
    })
  }

  const pod = createPod({
    name: podName,
    namespace: runtimeNamespace,
    restartPolicy: parsed.runRestart ?? 'Always',
    labels: { run: podName, ...(parsed.runLabels ?? {}) },
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

  if (parsed.runDryRunClient) {
    const dryRunManifest = buildRunDryRunManifest(
      podName,
      parsed,
      image,
      envVars,
      runCommand,
      runArgs
    )
    return buildDryRunResponse(dryRunManifest, parsed)
  }

  const commandToExecute = runCommand ?? runArgs
  const hasInlineCommand =
    commandToExecute != null && commandToExecute.length > 0 && isAttachLike
  if (hasInlineCommand) {
    const sourcePodForTraffic: SimTrafficPodIdentity = {
      name: podName,
      namespace: runtimeNamespace,
      labels: { run: podName, ...(parsed.runLabels ?? {}) }
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
