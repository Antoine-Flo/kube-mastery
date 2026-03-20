import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { EnvVar } from '../../../cluster/ressources/Pod'
import { createPod } from '../../../cluster/ressources/Pod'
import type { SimNetworkRuntime } from '../../../network/SimNetworkRuntime'
import type { ExecutionResult } from '../../../shared/result'
import { error } from '../../../shared/result'
import { validateMetadataNameByKind } from '../metadataNameValidation'
import type { ParsedCommand } from '../types'
import { buildDryRunResponse } from './create'
import { createResourceWithEvents } from '../resourceHelpers'

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
    namespace: parsed.namespace || 'default',
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

  const runCommandHead = runCommand?.[0]
  if (
    parsed.runUseCommand &&
    parsed.runRemove === true &&
    parsed.runStdin === true &&
    parsed.runTty === true &&
    runCommandHead != null &&
    networkRuntime != null
  ) {
    const runtimeNamespace = parsed.namespace || 'default'
    if (runCommandHead === 'nslookup') {
      const lookupQuery = runCommand?.[1]
      if (lookupQuery == null) {
        return error('** server can not find : NXDOMAIN')
      }
      const dnsResult = networkRuntime.dnsResolver.resolveARecord(
        lookupQuery,
        runtimeNamespace
      )
      if (!dnsResult.ok) {
        return error(dnsResult.error)
      }
      const address = dnsResult.value.addresses[0]
      return {
        ok: true,
        value: [
          'Server:\t10.96.0.10',
          'Address:\t10.96.0.10:53',
          '',
          `Name:\t${dnsResult.value.fqdn}`,
          `Address:\t${address}`
        ].join('\n')
      }
    }
    if (runCommandHead === 'curl') {
      const curlTarget = runCommand?.[1]
      if (curlTarget == null) {
        return error('curl: try "curl <url>"')
      }
      const curlResult = networkRuntime.trafficEngine.simulateHttpGet(
        curlTarget,
        {
          sourceNamespace: runtimeNamespace
        }
      )
      if (!curlResult.ok) {
        return error(curlResult.error)
      }
      return { ok: true, value: curlResult.value }
    }
  }

  return createResourceWithEvents(pod, apiServer)
}
