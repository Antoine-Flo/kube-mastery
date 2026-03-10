// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL APPLY & CREATE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════
// Unified handlers for apply and create commands using event-driven architecture

import type { ClusterState } from '../../../cluster/ClusterState'
import type { EventBus } from '../../../cluster/events/EventBus'
import { createDeployment } from '../../../cluster/ressources/Deployment'
import { createNamespace } from '../../../cluster/ressources/Namespace'
import type { EnvVar } from '../../../cluster/ressources/Pod'
import { createPod } from '../../../cluster/ressources/Pod'
import type { PodTemplateSpec } from '../../../cluster/ressources/ReplicaSet'
import type { FileSystem } from '../../../filesystem/FileSystem'
import type { SimNetworkRuntime } from '../../../network/SimNetworkRuntime'
import type { ExecutionResult } from '../../../shared/result'
import { error } from '../../../shared/result'
import { stringify as yamlStringify } from 'yaml'
import { parseKubernetesYaml } from '../../yamlParser'
import type { ParsedCommand } from '../types'
import {
  applyResourceWithEvents,
  createResourceWithEvents
} from './resourceHelpers'

const isDryRunClient = (parsed: ParsedCommand): boolean => {
  return parsed.flags['dry-run'] === 'client'
}

const isSupportedDryRunValue = (value: unknown): boolean => {
  if (value === undefined) {
    return true
  }
  if (value === 'none' || value === 'server' || value === 'client') {
    return true
  }
  return false
}

const sanitizeForDryRunOutput = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeForDryRunOutput(item))
  }
  if (value == null || typeof value !== 'object') {
    return value
  }
  const entries = Object.entries(value as Record<string, unknown>)
  const sanitizedEntries = entries
    .filter(([key]) => key !== '_simulator')
    .map(([key, item]) => [key, sanitizeForDryRunOutput(item)] as const)
  return Object.fromEntries(sanitizedEntries)
}

const buildDryRunCreatedMessage = (resource: any): string => {
  const kindRaw = resource?.kind
  const nameRaw = resource?.metadata?.name
  if (typeof kindRaw !== 'string' || typeof nameRaw !== 'string') {
    return 'resource created (dry run)'
  }
  const kind = kindRaw.toLowerCase()
  return `${kind}/${nameRaw} created (dry run)`
}

const buildDryRunResponse = (
  resource: any,
  parsed: ParsedCommand
): ExecutionResult => {
  const output = parsed.output ?? 'table'
  const sanitized = sanitizeForDryRunOutput(resource)

  if (output === 'yaml') {
    return {
      ok: true,
      value: yamlStringify(sanitized, {
        indentSeq: false,
        aliasDuplicateObjects: false
      }).trimEnd()
    }
  }
  if (output === 'json') {
    return {
      ok: true,
      value: JSON.stringify(sanitized, null, 4)
    }
  }

  return {
    ok: true,
    value: buildDryRunCreatedMessage(resource)
  }
}

const buildCreateDeploymentDryRunManifest = (
  parsed: ParsedCommand & { name: string }
): Record<string, unknown> => {
  const images = getCreateImages(parsed)
  if (images.length === 0) {
    return {}
  }

  const metadataLabels = { app: parsed.name }
  const container = {
    image: images[0],
    name: images[0].split('/').pop()?.split(':')[0] || parsed.name,
    resources: {}
  } as Record<string, unknown>

  if (parsed.port != null) {
    container['ports'] = [{ containerPort: parsed.port }]
  }
  if (parsed.createCommand != null && parsed.createCommand.length > 0) {
    container['command'] = parsed.createCommand
  }

  return {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      creationTimestamp: null,
      labels: metadataLabels,
      name: parsed.name,
      ...(parsed.namespace != null && parsed.namespace !== 'default'
        ? { namespace: parsed.namespace }
        : {})
    },
    spec: {
      replicas: parsed.replicas ?? 1,
      selector: { matchLabels: metadataLabels },
      strategy: {},
      template: {
        metadata: {
          creationTimestamp: null,
          labels: metadataLabels
        },
        spec: {
          containers: [container]
        }
      }
    },
    status: {}
  }
}

const buildCreateNamespaceDryRunManifest = (
  parsed: ParsedCommand & { name: string }
): Record<string, unknown> => {
  return {
    apiVersion: 'v1',
    kind: 'Namespace',
    metadata: {
      creationTimestamp: null,
      labels: {
        'kubernetes.io/metadata.name': parsed.name
      },
      name: parsed.name
    },
    status: {}
  }
}

const getFilenameFromFlags = (parsed: ParsedCommand): string | undefined => {
  const filename = parsed.flags.f || parsed.flags.filename
  if (typeof filename !== 'string') {
    return undefined
  }
  return filename
}

const getCreateImages = (parsed: ParsedCommand): string[] => {
  if (parsed.createImages && parsed.createImages.length > 0) {
    return parsed.createImages
  }

  const imageFlag = parsed.flags.image
  if (typeof imageFlag !== 'string') {
    return []
  }

  return [imageFlag]
}

const getContainerName = (
  deploymentName: string,
  image: string,
  index: number
): string => {
  const imageBaseName = image.split('/').pop() || image
  const imageWithoutTag = imageBaseName.split(':')[0]
  const sanitized = imageWithoutTag.replace(/[^a-zA-Z0-9-]/g, '-')
  if (sanitized.length > 0) {
    return sanitized
  }
  return `${deploymentName}-${index + 1}`
}

const buildPodTemplate = (
  deploymentName: string,
  images: string[],
  command?: string[],
  port?: number
): PodTemplateSpec => {
  const containers = images.map((image, index) => {
    const container = {
      name: getContainerName(deploymentName, image, index),
      image
    } as PodTemplateSpec['spec']['containers'][number]

    if (command && command.length > 0) {
      container.command = command
    }
    if (typeof port === 'number') {
      container.ports = [{ containerPort: port }]
    }

    return container
  })

  return {
    metadata: {
      labels: { app: deploymentName }
    },
    spec: { containers }
  }
}

const isCreateDeploymentImperative = (
  parsed: ParsedCommand
): parsed is ParsedCommand & { name: string } => {
  if (parsed.resource !== 'deployments') {
    return false
  }
  if (typeof parsed.name !== 'string') {
    return false
  }
  return parsed.name.length > 0
}

const isCreateNamespaceImperative = (
  parsed: ParsedCommand
): parsed is ParsedCommand & { name: string } => {
  if (parsed.resource !== 'namespaces') {
    return false
  }
  if (typeof parsed.name !== 'string') {
    return false
  }
  return parsed.name.length > 0
}

const isCreateDeploymentCommand = (parsed: ParsedCommand): boolean => {
  return parsed.resource === 'deployments'
}

const validateCreateDeploymentCommand = (
  parsed: ParsedCommand
): ExecutionResult | undefined => {
  if (!isCreateDeploymentCommand(parsed)) {
    return undefined
  }

  if (typeof parsed.name !== 'string' || parsed.name.length === 0) {
    return error('error: create deployment requires a name')
  }

  return undefined
}

const createDeploymentFromFlags = (
  parsed: ParsedCommand & { name: string },
  clusterState: ClusterState,
  eventBus: EventBus
): ExecutionResult => {
  const images = getCreateImages(parsed)
  if (
    images.length > 1 &&
    parsed.createCommand &&
    parsed.createCommand.length > 0
  ) {
    return error('error: cannot specify multiple --image options and command')
  }

  if (images.length === 0) {
    return error('error: required flag(s) "image" not set')
  }

  const deploymentName = parsed.name
  const namespace = parsed.namespace || 'default'
  const template = buildPodTemplate(
    deploymentName,
    images,
    parsed.createCommand,
    parsed.port
  )

  const deployment = createDeployment({
    name: deploymentName,
    namespace,
    replicas: parsed.replicas,
    selector: { matchLabels: { app: deploymentName } },
    template
  })

  return createResourceWithEvents(deployment, clusterState, eventBus)
}

const createNamespaceFromFlags = (
  parsed: ParsedCommand & { name: string },
  clusterState: ClusterState,
  eventBus: EventBus
): ExecutionResult => {
  const namespace = createNamespace({
    name: parsed.name,
    labels: {
      'kubernetes.io/metadata.name': parsed.name
    }
  })

  return createResourceWithEvents(namespace, clusterState, eventBus)
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
  const env = envVars.map((envVar) => {
    if (envVar.source.type !== 'value') {
      return undefined
    }
    return {
      name: envVar.name,
      value: envVar.source.value
    }
  }).filter((entry): entry is { name: string; value: string } => entry != null)
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
      creationTimestamp: null,
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
 * Shared helper to load and parse YAML from filesystem
 */
const loadAndParseYaml = (
  fileSystem: FileSystem,
  parsed: ParsedCommand
): ExecutionResult & { resource?: any } => {
  // Extract filename from flags
  const filename = getFilenameFromFlags(parsed)

  if (!filename) {
    return error('error: must specify one of -f or --filename')
  }

  // Read file from filesystem
  const fileResult = fileSystem.readFile(filename as string)
  if (!fileResult.ok) {
    return error(`error: ${fileResult.error}`)
  }

  // Parse and validate YAML
  const parseResult = parseKubernetesYaml(fileResult.value)
  if (!parseResult.ok) {
    return error(`error: ${parseResult.error}`)
  }

  return { ok: true, value: '', resource: parseResult.value }
}

/**
 * Handle kubectl apply command
 * Creates or updates resources from YAML files
 */
export const handleApply = (
  fileSystem: FileSystem,
  clusterState: ClusterState,
  parsed: ParsedCommand,
  eventBus: EventBus
): ExecutionResult => {
  const loadResult = loadAndParseYaml(fileSystem, parsed)
  if (!loadResult.ok) {
    return loadResult
  }

  return applyResourceWithEvents(loadResult.resource, clusterState, eventBus)
}

/**
 * Handle kubectl create command
 * Creates resources from YAML files (fails if resource already exists)
 */
export const handleCreate = (
  fileSystem: FileSystem,
  clusterState: ClusterState,
  parsed: ParsedCommand,
  eventBus: EventBus
): ExecutionResult => {
  const dryRunFlag = parsed.flags['dry-run']
  if (!isSupportedDryRunValue(dryRunFlag)) {
    return error(
      `error: Invalid dry-run value (${String(dryRunFlag)}). Must be "none", "server", or "client".`
    )
  }

  const validationResult = validateCreateDeploymentCommand(parsed)
  if (validationResult) {
    return validationResult
  }

  if (isCreateDeploymentImperative(parsed)) {
    if (isDryRunClient(parsed)) {
      const dryRunManifest = buildCreateDeploymentDryRunManifest(parsed)
      return buildDryRunResponse(dryRunManifest, parsed)
    }
    return createDeploymentFromFlags(parsed, clusterState, eventBus)
  }

  if (isCreateNamespaceImperative(parsed)) {
    if (isDryRunClient(parsed)) {
      const dryRunManifest = buildCreateNamespaceDryRunManifest(parsed)
      return buildDryRunResponse(dryRunManifest, parsed)
    }
    return createNamespaceFromFlags(parsed, clusterState, eventBus)
  }

  const loadResult = loadAndParseYaml(fileSystem, parsed)
  if (!loadResult.ok) {
    return loadResult
  }

  if (isDryRunClient(parsed)) {
    return buildDryRunResponse(loadResult.resource, parsed)
  }

  return createResourceWithEvents(loadResult.resource, clusterState, eventBus)
}

/**
 * Handle kubectl run command (minimal scope)
 * Creates a single Pod with one container and command from `--command -- ...`.
 */
export const handleRun = (
  clusterState: ClusterState,
  parsed: ParsedCommand,
  eventBus: EventBus,
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
  for (const envValue of runEnv) {
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
    ...(parsed.runLabels && { labels: parsed.runLabels }),
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
    if (parsed.output === 'yaml') {
      const dryRunManifest = buildRunDryRunManifest(
        podName,
        parsed,
        image,
        envVars,
        runCommand,
        runArgs
      )
      return {
        ok: true,
        value: yamlStringify(dryRunManifest, {
          indentSeq: false,
          aliasDuplicateObjects: false
        }).trimEnd()
      }
    }
    return { ok: true, value: `pod/${podName} created (dry run)` }
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

  return createResourceWithEvents(pod, clusterState, eventBus)
}
