import type { ApiServerFacade } from '../../../../../api/ApiServerFacade'
import {
  createSecret,
  encodeBase64
} from '../../../../../cluster/ressources/Secret'
import type { FileSystem } from '../../../../../filesystem/FileSystem'
import type { ExecutionResult } from '../../../../../shared/result'
import { formatKubectlFileSystemError } from '../../../filesystemErrorPresenter'
import { createResourceWithEvents } from '../../../resourceHelpers'
import type { ParsedCommand } from '../../../types'
import { isExecutionErrorResult } from './configMap'
import type {
  CreateSecretType,
  ErrorResult,
  ImperativeCreateSecretConfig,
  PreparedSecret
} from './types'

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
    return {
      ok: false,
      error: `error: no data found in env file: ${sourcePath}`
    }
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
  if (
    Array.isArray(parsed.createFromFiles) &&
    parsed.createFromFiles.length > 0
  ) {
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

  if (
    literals.length === 0 &&
    fromFiles.length === 0 &&
    fromEnvFiles.length === 0
  ) {
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
    const fileReadResult = fileSystem.readFileDetailed(
      parsedFromFile.sourcePath
    )
    if (!fileReadResult.ok) {
      return {
        ok: false,
        error: formatKubectlFileSystemError(
          fileReadResult.error,
          parsedFromFile.sourcePath
        )
      }
    }
    data[parsedFromFile.key] = encodeBase64(fileReadResult.value)
  }

  for (const envFilePath of fromEnvFiles) {
    const envFileReadResult = fileSystem.readFileDetailed(envFilePath)
    if (!envFileReadResult.ok) {
      return {
        ok: false,
        error: formatKubectlFileSystemError(
          envFileReadResult.error,
          envFilePath
        )
      }
    }
    const parsedEnvFile = parseEnvFileContent(
      envFileReadResult.value,
      envFilePath
    )
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
  const certReadResult = fileSystem.readFileDetailed(certPath)
  if (!certReadResult.ok) {
    return {
      ok: false,
      error: formatKubectlFileSystemError(certReadResult.error, certPath)
    }
  }
  const keyReadResult = fileSystem.readFileDetailed(keyPath)
  if (!keyReadResult.ok) {
    return {
      ok: false,
      error: formatKubectlFileSystemError(keyReadResult.error, keyPath)
    }
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
      error:
        'error: create secret docker-registry requires flag --docker-server'
    }
  }
  if (typeof username !== 'string' || username.trim().length === 0) {
    return {
      ok: false,
      error:
        'error: create secret docker-registry requires flag --docker-username'
    }
  }
  if (typeof password !== 'string' || password.trim().length === 0) {
    return {
      ok: false,
      error:
        'error: create secret docker-registry requires flag --docker-password'
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

export const buildCreateSecretDryRunManifest = (
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

export const isCreateSecretImperative = (
  parsed: ParsedCommand
): parsed is ParsedCommand & {
  name: string
  createSecretType: CreateSecretType
} => {
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

export const createSecretFromFlags = (
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
