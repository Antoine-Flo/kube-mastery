// ═══════════════════════════════════════════════════════════════════════════
// KUBECTL APPLY & CREATE HANDLERS
// ═══════════════════════════════════════════════════════════════════════════
// Unified handlers for apply and create commands using event-driven architecture

import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import { createConfigMap } from '../../../cluster/ressources/ConfigMap'
import { createDeployment } from '../../../cluster/ressources/Deployment'
import { createNamespace } from '../../../cluster/ressources/Namespace'
import { createSecret, encodeBase64 } from '../../../cluster/ressources/Secret'
import type { EnvVar } from '../../../cluster/ressources/Pod'
import { createPod } from '../../../cluster/ressources/Pod'
import type { PodTemplateSpec } from '../../../cluster/ressources/ReplicaSet'
import { createService } from '../../../cluster/ressources/Service'
import type { FileSystem } from '../../../filesystem/FileSystem'
import type { SimNetworkRuntime } from '../../../network/SimNetworkRuntime'
import type { ExecutionResult } from '../../../shared/result'
import { error } from '../../../shared/result'
import { parseKubernetesYaml } from '../../yamlParser'
import {
  validateMetadataNameByKind,
  validateMetadataNameForResource
} from '../metadataNameValidation'
import type { ParsedCommand } from '../types'
import {
  renderStructuredPayload,
  resolveOutputDirective,
  validateOutputDirective
} from '../output/outputHelpers'
import {
  applyResourceWithEvents,
  createResourceWithEvents
} from './resourceHelpers'

type ErrorResult = { ok: false; error: string }

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
    return value
      .map((item) => sanitizeForDryRunOutput(item))
      .filter((item) => item !== undefined)
  }
  if (value == null || typeof value !== 'object') {
    if (value === null) {
      return undefined
    }
    return value
  }
  const entries = Object.entries(value as Record<string, unknown>)
  const sanitizedEntries = entries
    .filter(([key]) => key !== '_simulator')
    .map(([key, item]) => [key, sanitizeForDryRunOutput(item)] as const)
    .filter(([, item]) => item !== undefined)
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
  const metadataNameValidation = validateMetadataNameForResource(resource)
  if (metadataNameValidation != null) {
    return metadataNameValidation
  }

  const outputDirectiveResult = validateOutputDirective(
    resolveOutputDirective(parsed.flags, parsed.output),
    ['table', 'yaml', 'json', 'jsonpath'],
    "--output must be one of: json|yaml|jsonpath"
  )
  if (!outputDirectiveResult.ok) {
    return error(outputDirectiveResult.error)
  }
  const outputDirective = outputDirectiveResult.value
  const sanitized = sanitizeForDryRunOutput(resource)

  if (
    outputDirective.kind === 'yaml' ||
    outputDirective.kind === 'json' ||
    outputDirective.kind === 'jsonpath'
  ) {
    const renderResult = renderStructuredPayload(sanitized, outputDirective)
    if (!renderResult.ok) {
      return error(renderResult.error)
    }
    return {
      ok: true,
      value: renderResult.value
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
      name: parsed.name
    },
    spec: {},
    status: {}
  }
}

const parseConfigMapDataFromLiterals = (
  literals: string[]
): Record<string, string> | (ExecutionResult & { ok: false }) => {
  const data: Record<string, string> = {}
  for (const literal of literals) {
    const separatorIndex = literal.indexOf('=')
    if (separatorIndex <= 0) {
      return {
        ok: false,
        error: `error: invalid --from-literal value: ${literal}, expected key=value`
      }
    }
    const key = literal.slice(0, separatorIndex).trim()
    const value = literal.slice(separatorIndex + 1)
    if (key.length === 0) {
      return {
        ok: false,
        error: `error: invalid --from-literal value: ${literal}, expected key=value`
      }
    }
    data[key] = value
  }
  return data
}

const isExecutionErrorResult = (
  value: unknown
): value is ErrorResult => {
  if (value == null || typeof value !== 'object') {
    return false
  }
  if (!('ok' in value)) {
    return false
  }
  return (value as { ok?: unknown }).ok === false
}

const getCreateConfigMapLiterals = (parsed: ParsedCommand): string[] => {
  if (
    Array.isArray(parsed.createFromLiterals) &&
    parsed.createFromLiterals.length > 0
  ) {
    return parsed.createFromLiterals
  }
  const fromLiteral = parsed.flags['from-literal']
  if (typeof fromLiteral === 'string' && fromLiteral.length > 0) {
    return [fromLiteral]
  }
  return []
}

const buildCreateConfigMapDryRunManifest = (
  parsed: ParsedCommand & { name: string }
): Record<string, unknown> | ExecutionResult => {
  const literals = getCreateConfigMapLiterals(parsed)
  if (literals.length === 0) {
    return error(
      'error: create configmap requires at least one --from-literal=key=value'
    )
  }
  const data = parseConfigMapDataFromLiterals(literals)
  if (isExecutionErrorResult(data)) {
    return data
  }
  return {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: {
      name: parsed.name,
      ...(parsed.namespace != null && parsed.namespace !== 'default'
        ? { namespace: parsed.namespace }
        : {})
    },
    data
  }
}

type CreateServiceType = NonNullable<ParsedCommand['createServiceType']>
type CreateSecretType = NonNullable<ParsedCommand['createSecretType']>
type SecretTypeConfig = Parameters<typeof createSecret>[0]['secretType']

type ImperativeCreateServiceConfig = {
  apiVersion: 'v1'
  kind: 'Service'
  metadata: {
    name: string
    namespace?: string
    labels?: Record<string, string>
  }
  spec: {
    type: 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName'
    selector?: Record<string, string>
    externalName?: string
    ports: Array<{
      protocol: 'TCP'
      port: number
      targetPort?: number
      nodePort?: number
    }>
  }
  status: {
    loadBalancer: Record<string, never>
  }
}

type ImperativeCreateSecretConfig = {
  apiVersion: 'v1'
  kind: 'Secret'
  metadata: {
    name: string
    namespace?: string
  }
  type?: 'Opaque' | 'kubernetes.io/tls' | 'kubernetes.io/dockerconfigjson'
  data: Record<string, string>
}

type PreparedSecret = {
  secretType: SecretTypeConfig
  data: Record<string, string>
  manifestType: 'Opaque' | 'kubernetes.io/tls' | 'kubernetes.io/dockerconfigjson'
}

const toApiServiceType = (
  serviceType: CreateServiceType
): 'ClusterIP' | 'NodePort' | 'LoadBalancer' | 'ExternalName' => {
  if (serviceType === 'clusterip') {
    return 'ClusterIP'
  }
  if (serviceType === 'nodeport') {
    return 'NodePort'
  }
  if (serviceType === 'loadbalancer') {
    return 'LoadBalancer'
  }
  return 'ExternalName'
}

const parsePositivePortNumber = (
  rawValue: string,
  flagName: string
): number | ExecutionResult => {
  const parsed = Number.parseInt(rawValue, 10)
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    return error(`error: ${flagName} must be a valid port number`)
  }
  return parsed
}

const getFileBaseName = (path: string): string => {
  const normalized = path.replace(/\\/g, '/')
  const parts = normalized.split('/')
  return parts[parts.length - 1] || normalized
}

const parseFromFileEntry = (
  rawEntry: string
): { key: string; sourcePath: string } | ErrorResult => {
  const equalsIndex = rawEntry.indexOf('=')
  if (equalsIndex === -1) {
    const sourcePath = rawEntry.trim()
    if (sourcePath.length === 0) {
      return { ok: false, error: 'error: invalid --from-file value' }
    }
    return {
      key: getFileBaseName(sourcePath),
      sourcePath
    }
  }

  const key = rawEntry.slice(0, equalsIndex).trim()
  const sourcePath = rawEntry.slice(equalsIndex + 1).trim()
  if (key.length === 0 || sourcePath.length === 0) {
    return {
      ok: false,
      error: 'error: invalid --from-file value, expected [key=]path'
    }
  }
  return { key, sourcePath }
}

const parseKeyValueLiteral = (
  rawLiteral: string,
  flagName: string
): { key: string; value: string } | ErrorResult => {
  const separatorIndex = rawLiteral.indexOf('=')
  if (separatorIndex <= 0) {
    return {
      ok: false,
      error: `error: invalid ${flagName} value: ${rawLiteral}, expected key=value`
    }
  }
  const key = rawLiteral.slice(0, separatorIndex).trim()
  const value = rawLiteral.slice(separatorIndex + 1)
  if (key.length === 0) {
    return {
      ok: false,
      error: `error: invalid ${flagName} value: ${rawLiteral}, expected key=value`
    }
  }
  return { key, value }
}

const parseEnvFileContent = (
  content: string,
  sourcePath: string
): Record<string, string> | ErrorResult => {
  const result: Record<string, string> = {}
  const lines = content.split('\n')
  for (const lineRaw of lines) {
    const line = lineRaw.trim()
    if (line.length === 0 || line.startsWith('#')) {
      continue
    }
    const parsed = parseKeyValueLiteral(line, '--from-env-file')
    if (isExecutionErrorResult(parsed)) {
      return parsed
    }
    result[parsed.key] = parsed.value
  }
  if (Object.keys(result).length === 0) {
    return { ok: false, error: `error: no data found in env file: ${sourcePath}` }
  }
  return result
}

const getCreateSecretLiterals = (parsed: ParsedCommand): string[] => {
  if (
    Array.isArray(parsed.createFromLiterals) &&
    parsed.createFromLiterals.length > 0
  ) {
    return parsed.createFromLiterals
  }
  const fromLiteral = parsed.flags['from-literal']
  if (typeof fromLiteral === 'string' && fromLiteral.length > 0) {
    return [fromLiteral]
  }
  return []
}

const getCreateSecretFromFiles = (parsed: ParsedCommand): string[] => {
  if (Array.isArray(parsed.createFromFiles) && parsed.createFromFiles.length > 0) {
    return parsed.createFromFiles
  }
  const fromFile = parsed.flags['from-file']
  if (typeof fromFile === 'string' && fromFile.length > 0) {
    return [fromFile]
  }
  return []
}

const getCreateSecretFromEnvFiles = (parsed: ParsedCommand): string[] => {
  if (
    Array.isArray(parsed.createFromEnvFiles) &&
    parsed.createFromEnvFiles.length > 0
  ) {
    return parsed.createFromEnvFiles
  }
  const fromEnvFile = parsed.flags['from-env-file']
  if (typeof fromEnvFile === 'string' && fromEnvFile.length > 0) {
    return [fromEnvFile]
  }
  return []
}

const prepareGenericSecretData = (
  fileSystem: FileSystem,
  parsed: ParsedCommand
): PreparedSecret | ErrorResult => {
  const data: Record<string, string> = {}
  const literals = getCreateSecretLiterals(parsed)
  const fromFiles = getCreateSecretFromFiles(parsed)
  const fromEnvFiles = getCreateSecretFromEnvFiles(parsed)

  if (literals.length === 0 && fromFiles.length === 0 && fromEnvFiles.length === 0) {
    return {
      ok: false,
      error:
        'error: create secret generic requires at least one of: --from-literal, --from-file, --from-env-file'
    }
  }

  for (const literal of literals) {
    const parsedLiteral = parseKeyValueLiteral(literal, '--from-literal')
    if (isExecutionErrorResult(parsedLiteral)) {
      return parsedLiteral
    }
    data[parsedLiteral.key] = encodeBase64(parsedLiteral.value)
  }

  for (const fromFileEntry of fromFiles) {
    const parsedFromFile = parseFromFileEntry(fromFileEntry)
    if (isExecutionErrorResult(parsedFromFile)) {
      return parsedFromFile
    }
    const fileReadResult = fileSystem.readFile(parsedFromFile.sourcePath)
    if (!fileReadResult.ok) {
      return { ok: false, error: `error: ${fileReadResult.error}` }
    }
    data[parsedFromFile.key] = encodeBase64(fileReadResult.value)
  }

  for (const envFilePath of fromEnvFiles) {
    const envFileReadResult = fileSystem.readFile(envFilePath)
    if (!envFileReadResult.ok) {
      return { ok: false, error: `error: ${envFileReadResult.error}` }
    }
    const parsedEnvFile = parseEnvFileContent(envFileReadResult.value, envFilePath)
    if (isExecutionErrorResult(parsedEnvFile)) {
      return parsedEnvFile
    }
    for (const [key, value] of Object.entries(parsedEnvFile)) {
      data[key] = encodeBase64(value)
    }
  }

  return {
    secretType: { type: 'Opaque' },
    data,
    manifestType: 'Opaque'
  }
}

const prepareTlsSecretData = (
  fileSystem: FileSystem,
  parsed: ParsedCommand
): PreparedSecret | ErrorResult => {
  const certPath = parsed.flags.cert
  const keyPath = parsed.flags.key
  if (typeof certPath !== 'string' || certPath.trim().length === 0) {
    return { ok: false, error: 'error: create secret tls requires flag --cert' }
  }
  if (typeof keyPath !== 'string' || keyPath.trim().length === 0) {
    return { ok: false, error: 'error: create secret tls requires flag --key' }
  }
  const certReadResult = fileSystem.readFile(certPath)
  if (!certReadResult.ok) {
    return { ok: false, error: `error: ${certReadResult.error}` }
  }
  const keyReadResult = fileSystem.readFile(keyPath)
  if (!keyReadResult.ok) {
    return { ok: false, error: `error: ${keyReadResult.error}` }
  }
  return {
    secretType: { type: 'kubernetes.io/tls' },
    manifestType: 'kubernetes.io/tls',
    data: {
      'tls.crt': encodeBase64(certReadResult.value),
      'tls.key': encodeBase64(keyReadResult.value)
    }
  }
}

const prepareDockerRegistrySecretData = (
  parsed: ParsedCommand
): PreparedSecret | ErrorResult => {
  const server = parsed.flags['docker-server']
  const username = parsed.flags['docker-username']
  const password = parsed.flags['docker-password']
  const email = parsed.flags['docker-email']
  if (typeof server !== 'string' || server.trim().length === 0) {
    return {
      ok: false,
      error: 'error: create secret docker-registry requires flag --docker-server'
    }
  }
  if (typeof username !== 'string' || username.trim().length === 0) {
    return {
      ok: false,
      error: 'error: create secret docker-registry requires flag --docker-username'
    }
  }
  if (typeof password !== 'string' || password.trim().length === 0) {
    return {
      ok: false,
      error: 'error: create secret docker-registry requires flag --docker-password'
    }
  }
  const auth = encodeBase64(`${username}:${password}`)
  const dockerConfig = {
    auths: {
      [server]: {
        username,
        password,
        auth,
        ...(typeof email === 'string' && email.length > 0 ? { email } : {})
      }
    }
  }
  const dockerConfigJson = JSON.stringify(dockerConfig)
  return {
    secretType: {
      type: 'kubernetes.io/dockerconfigjson',
      dockerConfigJson
    },
    manifestType: 'kubernetes.io/dockerconfigjson',
    data: {
      '.dockerconfigjson': encodeBase64(dockerConfigJson)
    }
  }
}

const prepareSecretData = (
  fileSystem: FileSystem,
  parsed: ParsedCommand & { createSecretType: CreateSecretType }
): PreparedSecret | ErrorResult => {
  if (parsed.createSecretType === 'generic') {
    return prepareGenericSecretData(fileSystem, parsed)
  }
  if (parsed.createSecretType === 'tls') {
    return prepareTlsSecretData(fileSystem, parsed)
  }
  return prepareDockerRegistrySecretData(parsed)
}

const buildCreateSecretDryRunManifest = (
  fileSystem: FileSystem,
  parsed: ParsedCommand & { name: string; createSecretType: CreateSecretType }
): ImperativeCreateSecretConfig | ErrorResult => {
  const prepared = prepareSecretData(fileSystem, parsed)
  if (isExecutionErrorResult(prepared)) {
    return prepared
  }
  return {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: {
      name: parsed.name,
      ...(parsed.namespace != null && parsed.namespace !== 'default'
        ? { namespace: parsed.namespace }
        : {})
    },
    ...(parsed.createSecretType === 'generic'
      ? {}
      : { type: prepared.manifestType }),
    data: prepared.data
  }
}

const parseTcpFlag = (
  rawTcpFlag: string
): Array<{ port: number; targetPort?: number }> | ExecutionResult => {
  const entries = rawTcpFlag
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)

  if (entries.length === 0) {
    return error('error: create service requires flag --tcp')
  }

  const ports: Array<{ port: number; targetPort?: number }> = []
  for (const entry of entries) {
    const parts = entry.split(':')
    if (parts.length > 2) {
      return error('error: invalid --tcp format, expected port[:targetPort]')
    }
    const parsedPort = parsePositivePortNumber(parts[0], '--tcp')
    if (typeof parsedPort !== 'number') {
      return parsedPort
    }

    if (parts.length === 1 || parts[1].trim().length === 0) {
      ports.push({ port: parsedPort, targetPort: parsedPort })
      continue
    }

    const parsedTargetPort = parsePositivePortNumber(parts[1], '--tcp')
    if (typeof parsedTargetPort !== 'number') {
      return parsedTargetPort
    }
    ports.push({ port: parsedPort, targetPort: parsedTargetPort })
  }

  return ports
}

const parseNodePortFlag = (
  rawNodePortFlag: string | boolean | undefined
): number | undefined | ExecutionResult => {
  if (rawNodePortFlag == null) {
    return undefined
  }
  if (typeof rawNodePortFlag !== 'string' || rawNodePortFlag.trim().length === 0) {
    return error('error: --node-port must be a valid port number')
  }
  const parsed = parsePositivePortNumber(rawNodePortFlag, '--node-port')
  if (typeof parsed !== 'number') {
    return parsed
  }
  return parsed
}

const buildCreateServiceConfig = (
  parsed: ParsedCommand & { name: string; createServiceType: CreateServiceType }
): ImperativeCreateServiceConfig | ExecutionResult => {
  const namespace = parsed.namespace ?? 'default'
  const serviceType = parsed.createServiceType
  const apiServiceType = toApiServiceType(serviceType)
  const nodePortFlag = parseNodePortFlag(parsed.flags['node-port'])
  if (typeof nodePortFlag !== 'number' && nodePortFlag !== undefined) {
    return nodePortFlag
  }

  if (
    serviceType !== 'nodeport' &&
    typeof nodePortFlag === 'number'
  ) {
    return error(`error: create service ${serviceType} does not support flag --node-port`)
  }

  const metadata = {
    name: parsed.name,
    labels: { app: parsed.name },
    ...(namespace !== 'default' ? { namespace } : {})
  }

  if (serviceType === 'externalname') {
    const externalName = parsed.flags['external-name']
    if (typeof externalName !== 'string' || externalName.trim().length === 0) {
      return error('error: create service externalname requires flag --external-name')
    }
    return {
      apiVersion: 'v1',
      kind: 'Service',
      metadata,
      spec: {
        type: apiServiceType,
        externalName,
        ports: []
      },
      status: {
        loadBalancer: {}
      }
    }
  }

  const tcpFlag = parsed.flags.tcp
  if (typeof tcpFlag !== 'string' || tcpFlag.trim().length === 0) {
    return error('error: create service requires flag --tcp')
  }
  const parsedPorts = parseTcpFlag(tcpFlag)
  if (!Array.isArray(parsedPorts)) {
    return parsedPorts
  }

  const ports = parsedPorts.map((port, index) => {
    const targetPort = port.targetPort ?? port.port
    const portName = `${port.port}-${targetPort}`
    if (index === 0 && typeof nodePortFlag === 'number') {
      return {
        name: portName,
        protocol: 'TCP' as const,
        port: port.port,
        ...(port.targetPort != null ? { targetPort: port.targetPort } : {}),
        nodePort: nodePortFlag
      }
    }
    return {
      name: portName,
      protocol: 'TCP' as const,
      port: port.port,
      ...(port.targetPort != null ? { targetPort: port.targetPort } : {})
    }
  })

  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata,
    spec: {
      type: apiServiceType,
      selector: { app: parsed.name },
      ports
    },
    status: {
      loadBalancer: {}
    }
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

const isCreateServiceImperative = (
  parsed: ParsedCommand
): parsed is ParsedCommand & { name: string; createServiceType: CreateServiceType } => {
  if (parsed.resource !== 'services') {
    return false
  }
  if (typeof parsed.createServiceType !== 'string') {
    return false
  }
  if (typeof parsed.name !== 'string') {
    return false
  }
  return parsed.name.length > 0
}

const isCreateConfigMapImperative = (
  parsed: ParsedCommand
): parsed is ParsedCommand & { name: string } => {
  if (parsed.resource !== 'configmaps') {
    return false
  }
  if (typeof parsed.name !== 'string') {
    return false
  }
  return parsed.name.length > 0
}

const isCreateSecretImperative = (
  parsed: ParsedCommand
): parsed is ParsedCommand & { name: string; createSecretType: CreateSecretType } => {
  if (parsed.resource !== 'secrets') {
    return false
  }
  if (typeof parsed.createSecretType !== 'string') {
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

  const images = getCreateImages(parsed)
  if (images.length === 0) {
    return error('error: required flag(s) "image" not set')
  }
  if (images.length > 1 && parsed.createCommand && parsed.createCommand.length > 0) {
    return error('error: cannot specify multiple --image options and command')
  }

  return undefined
}

const createDeploymentFromFlags = (
  parsed: ParsedCommand & { name: string },
  apiServer: ApiServerFacade
): ExecutionResult => {
  const images = getCreateImages(parsed)

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
    labels: { app: deploymentName },
    replicas: parsed.replicas,
    selector: { matchLabels: { app: deploymentName } },
    template
  })

  return createResourceWithEvents(deployment, apiServer)
}

const createNamespaceFromFlags = (
  parsed: ParsedCommand & { name: string },
  apiServer: ApiServerFacade
): ExecutionResult => {
  const namespace = createNamespace({
    name: parsed.name,
    labels: {
      'kubernetes.io/metadata.name': parsed.name
    }
  })

  return createResourceWithEvents(namespace, apiServer)
}

const createServiceFromFlags = (
  parsed: ParsedCommand & { name: string; createServiceType: CreateServiceType },
  apiServer: ApiServerFacade
): ExecutionResult => {
  const serviceConfig = buildCreateServiceConfig(parsed)
  if (!('kind' in serviceConfig)) {
    return serviceConfig
  }

  const namespace = parsed.namespace ?? 'default'
  const service = createService({
    name: parsed.name,
    namespace,
    type: serviceConfig.spec.type,
    ...(serviceConfig.spec.selector != null
      ? { selector: serviceConfig.spec.selector }
      : {}),
    ...(serviceConfig.spec.externalName != null
      ? { externalName: serviceConfig.spec.externalName }
      : {}),
    ports: serviceConfig.spec.ports
  })

  return createResourceWithEvents(service, apiServer)
}

const createConfigMapFromFlags = (
  parsed: ParsedCommand & { name: string },
  apiServer: ApiServerFacade
): ExecutionResult => {
  const literals = getCreateConfigMapLiterals(parsed)
  if (literals.length === 0) {
    return error(
      'error: create configmap requires at least one --from-literal=key=value'
    )
  }
  const data = parseConfigMapDataFromLiterals(literals)
  if (isExecutionErrorResult(data)) {
    return data
  }
  const configMap = createConfigMap({
    name: parsed.name,
    namespace: parsed.namespace ?? 'default',
    data
  })
  return createResourceWithEvents(configMap, apiServer)
}

const createSecretFromFlags = (
  fileSystem: FileSystem,
  parsed: ParsedCommand & { name: string; createSecretType: CreateSecretType },
  apiServer: ApiServerFacade
): ExecutionResult => {
  const prepared = prepareSecretData(fileSystem, parsed)
  if (isExecutionErrorResult(prepared)) {
    return prepared
  }
  const secret = createSecret({
    name: parsed.name,
    namespace: parsed.namespace ?? 'default',
    secretType: prepared.secretType,
    data: prepared.data
  })
  return createResourceWithEvents(secret, apiServer)
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
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
): ExecutionResult => {
  const loadResult = loadAndParseYaml(fileSystem, parsed)
  if (!loadResult.ok) {
    return loadResult
  }

  return applyResourceWithEvents(loadResult.resource, apiServer)
}

/**
 * Handle kubectl create command
 * Creates resources from YAML files (fails if resource already exists)
 */
export const handleCreate = (
  fileSystem: FileSystem,
  apiServer: ApiServerFacade,
  parsed: ParsedCommand
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
    return createDeploymentFromFlags(parsed, apiServer)
  }

  if (isCreateNamespaceImperative(parsed)) {
    if (isDryRunClient(parsed)) {
      const dryRunManifest = buildCreateNamespaceDryRunManifest(parsed)
      return buildDryRunResponse(dryRunManifest, parsed)
    }
    return createNamespaceFromFlags(parsed, apiServer)
  }

  if (isCreateServiceImperative(parsed)) {
    const serviceConfig = buildCreateServiceConfig(parsed)
    if (!('kind' in serviceConfig)) {
      return serviceConfig
    }
    if (isDryRunClient(parsed)) {
      return buildDryRunResponse(serviceConfig, parsed)
    }
    return createServiceFromFlags(parsed, apiServer)
  }

  if (isCreateConfigMapImperative(parsed)) {
    if (isDryRunClient(parsed)) {
      const dryRunManifest = buildCreateConfigMapDryRunManifest(parsed)
      if (isExecutionErrorResult(dryRunManifest)) {
        return dryRunManifest
      }
      return buildDryRunResponse(dryRunManifest, parsed)
    }
    return createConfigMapFromFlags(parsed, apiServer)
  }

  if (isCreateSecretImperative(parsed)) {
    if (isDryRunClient(parsed)) {
      const dryRunManifest = buildCreateSecretDryRunManifest(fileSystem, parsed)
      if (isExecutionErrorResult(dryRunManifest)) {
        return dryRunManifest
      }
      return buildDryRunResponse(dryRunManifest, parsed)
    }
    return createSecretFromFlags(fileSystem, parsed, apiServer)
  }

  const loadResult = loadAndParseYaml(fileSystem, parsed)
  if (!loadResult.ok) {
    return loadResult
  }

  if (isDryRunClient(parsed)) {
    return buildDryRunResponse(loadResult.resource, parsed)
  }

  return createResourceWithEvents(loadResult.resource, apiServer)
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
    restartPolicy: parsed.runRestart ?? 'Always',
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
