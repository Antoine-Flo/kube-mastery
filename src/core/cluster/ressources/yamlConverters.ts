// ═══════════════════════════════════════════════════════════════════════════
// YAML TO TYPESCRIPT CONVERTERS
// ═══════════════════════════════════════════════════════════════════════════
// Pure functions to convert YAML manifest format to TypeScript ADT format.
// Used during YAML parsing to normalize Kubernetes resource structures.
// Tolerates invalid formats by returning null (filtered out during parsing).

import type { EnvVar, Probe, Volume, VolumeSource } from './Pod'
import type { SecretType } from './Secret'

// ─── Validation Helpers ────────────────────────────────────────────────────

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const getStringField = (
  obj: Record<string, unknown>,
  key: string
): string | null => {
  const value = obj[key]
  return typeof value === 'string' ? value : null
}

const getNumberField = (
  obj: Record<string, unknown>,
  key: string
): number | null => {
  const value = obj[key]
  return typeof value === 'number' ? value : null
}

const getArrayField = <T>(
  obj: Record<string, unknown>,
  key: string,
  validator: (item: unknown) => item is T
): T[] | null => {
  const value = obj[key]
  if (!Array.isArray(value)) {
    return null
  }
  if (value.every(validator)) {
    return value
  }
  return null
}

// ─── Volume Conversion ──────────────────────────────────────────────────────

type VolumeHandler = (vol: Record<string, unknown>) => VolumeSource | null

const convertConfigMapVolume: VolumeHandler = (vol) => {
  const configMap = vol.configMap
  if (!isRecord(configMap)) {
    return null
  }
  const name = getStringField(configMap, 'name')
  if (!name) {
    return null
  }
  return { type: 'configMap', name }
}

const convertSecretVolume: VolumeHandler = (vol) => {
  const secret = vol.secret
  if (!isRecord(secret)) {
    return null
  }
  const secretName =
    getStringField(secret, 'secretName') || getStringField(secret, 'name')
  if (!secretName) {
    return null
  }
  return { type: 'secret', secretName }
}

const convertEmptyDirVolume: VolumeHandler = (vol) => {
  const emptyDir = vol.emptyDir
  if (!isRecord(emptyDir)) {
    return null
  }

  const mediumRaw = getStringField(emptyDir, 'medium')
  const medium = mediumRaw === 'Memory' ? 'Memory' : undefined
  const sizeLimit = getStringField(emptyDir, 'sizeLimit') ?? undefined

  return {
    type: 'emptyDir',
    ...(medium && { medium }),
    ...(sizeLimit && { sizeLimit })
  }
}

const convertHostPathVolume: VolumeHandler = (vol) => {
  const hostPath = vol.hostPath
  if (!isRecord(hostPath)) {
    return null
  }

  const path = getStringField(hostPath, 'path')
  if (!path) {
    return null
  }
  const hostPathType = getStringField(hostPath, 'type') ?? undefined
  return {
    type: 'hostPath',
    path,
    ...(hostPathType && { hostPathType })
  }
}

const convertPersistentVolumeClaimVolume: VolumeHandler = (vol) => {
  const persistentVolumeClaim = vol.persistentVolumeClaim
  if (!isRecord(persistentVolumeClaim)) {
    return null
  }

  const claimName = getStringField(persistentVolumeClaim, 'claimName')
  if (!claimName) {
    return null
  }

  const readOnlyRaw = persistentVolumeClaim.readOnly
  const readOnly = typeof readOnlyRaw === 'boolean' ? readOnlyRaw : undefined
  return {
    type: 'persistentVolumeClaim',
    claimName,
    ...(readOnly !== undefined && { readOnly })
  }
}

const VOLUME_HANDLERS: Record<string, VolumeHandler> = {
  configMap: convertConfigMapVolume,
  secret: convertSecretVolume,
  emptyDir: convertEmptyDirVolume,
  hostPath: convertHostPathVolume,
  persistentVolumeClaim: convertPersistentVolumeClaimVolume
}

/**
 * Convert YAML volume format to TypeScript Volume type
 * Tolerates invalid volumes by returning null (filtered out during parsing)
 *
 * YAML format: { name: "x", configMap: { name: "y" } }
 * TypeScript format: { name: "x", source: { type: "configMap", name: "y" } }
 */
export const convertYamlVolume = (yamlVolume: unknown): Volume | null => {
  if (!isRecord(yamlVolume)) {
    return null
  }

  const name = getStringField(yamlVolume, 'name')
  if (!name) {
    return null
  }

  // Try each volume type handler
  for (const [key, handler] of Object.entries(VOLUME_HANDLERS)) {
    if (yamlVolume[key] !== undefined) {
      const source = handler(yamlVolume)
      if (source) {
        return { name, source }
      }
    }
  }

  return null
}

// ─── Environment Variable Conversion ──────────────────────────────────────

const convertValueEnvVar = (
  env: Record<string, unknown>,
  name: string
): EnvVar | null => {
  const value = getStringField(env, 'value')
  if (!value) {
    return null
  }
  return {
    name,
    source: { type: 'value', value }
  }
}

const convertSecretKeyRefEnvVar = (
  env: Record<string, unknown>,
  name: string
): EnvVar | null => {
  const valueFrom = env.valueFrom
  if (!isRecord(valueFrom)) {
    return null
  }
  const secretKeyRef = valueFrom.secretKeyRef
  if (!isRecord(secretKeyRef)) {
    return null
  }
  const refName = getStringField(secretKeyRef, 'name')
  const key = getStringField(secretKeyRef, 'key')
  if (!refName || !key) {
    return null
  }
  return {
    name,
    source: { type: 'secretKeyRef', name: refName, key }
  }
}

const convertConfigMapKeyRefEnvVar = (
  env: Record<string, unknown>,
  name: string
): EnvVar | null => {
  const valueFrom = env.valueFrom
  if (!isRecord(valueFrom)) {
    return null
  }
  const configMapKeyRef = valueFrom.configMapKeyRef
  if (!isRecord(configMapKeyRef)) {
    return null
  }
  const refName = getStringField(configMapKeyRef, 'name')
  const key = getStringField(configMapKeyRef, 'key')
  if (!refName || !key) {
    return null
  }
  return {
    name,
    source: { type: 'configMapKeyRef', name: refName, key }
  }
}

type EnvVarHandler = (
  env: Record<string, unknown>,
  name: string
) => EnvVar | null

const ENV_VAR_HANDLERS: EnvVarHandler[] = [
  convertValueEnvVar,
  convertSecretKeyRefEnvVar,
  convertConfigMapKeyRefEnvVar
]

/**
 * Convert YAML env var format to TypeScript EnvVar type
 * Tolerates invalid env vars by returning null
 *
 * YAML formats:
 * - { name: "X", value: "y" } → { name: "X", source: { type: "value", value: "y" } }
 * - { name: "X", valueFrom: { secretKeyRef: { name: "s", key: "k" } } } → { name: "X", source: { type: "secretKeyRef", name: "s", key: "k" } }
 * - { name: "X", valueFrom: { configMapKeyRef: { name: "c", key: "k" } } } → { name: "X", source: { type: "configMapKeyRef", name: "c", key: "k" } }
 */
export const convertYamlEnvVar = (yamlEnv: unknown): EnvVar | null => {
  if (!isRecord(yamlEnv)) {
    return null
  }

  const name = getStringField(yamlEnv, 'name')
  if (!name) {
    return null
  }

  // Try each handler in order (value takes priority)
  for (const handler of ENV_VAR_HANDLERS) {
    const result = handler(yamlEnv, name)
    if (result) {
      return result
    }
  }

  return null
}

// ─── Probe Conversion ──────────────────────────────────────────────────────

const convertHttpGetProbe = (probe: Record<string, unknown>): Probe | null => {
  const httpGet = probe.httpGet
  if (!isRecord(httpGet)) {
    return null
  }
  const path = getStringField(httpGet, 'path')
  const port = getNumberField(httpGet, 'port')
  if (!path || !port) {
    return null
  }
  const result: Probe = {
    type: 'httpGet',
    path,
    port
  }
  applyProbeTimingFields(probe, result)
  return result
}

const convertExecProbe = (probe: Record<string, unknown>): Probe | null => {
  const exec = probe.exec
  if (!isRecord(exec)) {
    return null
  }
  const command = getArrayField(
    exec,
    'command',
    (cmd): cmd is string => typeof cmd === 'string'
  )
  if (!command) {
    return null
  }
  const result: Probe = {
    type: 'exec',
    command
  }
  applyProbeTimingFields(probe, result)
  return result
}

const convertTcpSocketProbe = (
  probe: Record<string, unknown>
): Probe | null => {
  const tcpSocket = probe.tcpSocket
  if (!isRecord(tcpSocket)) {
    return null
  }
  const port = getNumberField(tcpSocket, 'port')
  if (!port) {
    return null
  }
  const result: Probe = {
    type: 'tcpSocket',
    port
  }
  applyProbeTimingFields(probe, result)
  return result
}

type ProbeHandler = (probe: Record<string, unknown>) => Probe | null

const applyProbeTimingFields = (
  probe: Record<string, unknown>,
  target: Probe
): void => {
  const initialDelay = getNumberField(probe, 'initialDelaySeconds')
  const period = getNumberField(probe, 'periodSeconds')
  const timeout = getNumberField(probe, 'timeoutSeconds')
  const successThreshold = getNumberField(probe, 'successThreshold')
  const failureThreshold = getNumberField(probe, 'failureThreshold')
  if (initialDelay !== null) {
    target.initialDelaySeconds = initialDelay
  }
  if (period !== null) {
    target.periodSeconds = period
  }
  if (timeout !== null) {
    target.timeoutSeconds = timeout
  }
  if (successThreshold !== null) {
    target.successThreshold = successThreshold
  }
  if (failureThreshold !== null) {
    target.failureThreshold = failureThreshold
  }
}

const PROBE_HANDLERS: Record<string, ProbeHandler> = {
  httpGet: convertHttpGetProbe,
  exec: convertExecProbe,
  tcpSocket: convertTcpSocketProbe
}

/**
 * Convert YAML probe format to TypeScript Probe type
 * Tolerates invalid probes by returning null
 *
 * YAML formats:
 * - { httpGet: { path: "/", port: 80 } } → { type: "httpGet", path: "/", port: 80 }
 * - { exec: { command: ["cat", "/file"] } } → { type: "exec", command: ["cat", "/file"] }
 * - { tcpSocket: { port: 3306 } } → { type: "tcpSocket", port: 3306 }
 */
export const convertYamlProbe = (yamlProbe: unknown): Probe | null => {
  if (!isRecord(yamlProbe)) {
    return null
  }

  // Try each probe type handler
  for (const [key, handler] of Object.entries(PROBE_HANDLERS)) {
    if (yamlProbe[key] !== undefined) {
      const result = handler(yamlProbe)
      if (result) {
        return result
      }
    }
  }

  return null
}

// ─── Secret Type Conversion ────────────────────────────────────────────────

type SecretTypeHandler = (
  metadataName: string,
  data: Record<string, string>
) => SecretType

const convertOpaqueSecretType: SecretTypeHandler = () => {
  return { type: 'Opaque' }
}

const convertServiceAccountTokenType: SecretTypeHandler = (metadataName) => {
  return {
    type: 'kubernetes.io/service-account-token',
    serviceAccountName: metadataName
  }
}

const convertDockerConfigJsonType: SecretTypeHandler = (_, data) => {
  return {
    type: 'kubernetes.io/dockerconfigjson',
    dockerConfigJson: data['.dockerconfigjson'] || ''
  }
}

const SECRET_TYPE_HANDLERS: Record<string, SecretTypeHandler> = {
  Opaque: convertOpaqueSecretType,
  'kubernetes.io/service-account-token': convertServiceAccountTokenType,
  'kubernetes.io/dockerconfigjson': convertDockerConfigJsonType
}

/**
 * Convert YAML secret type string to TypeScript SecretType ADT
 *
 * YAML format: type: "Opaque" (string)
 * TypeScript format: { type: "Opaque" } (ADT)
 */
export const convertYamlSecretType = (
  yamlType: string | undefined,
  metadataName: string,
  data: Record<string, string>
): SecretType => {
  if (!yamlType) {
    return convertOpaqueSecretType(metadataName, data)
  }

  const handler = SECRET_TYPE_HANDLERS[yamlType]
  if (handler) {
    return handler(metadataName, data)
  }

  // Default to Opaque for unknown types
  return convertOpaqueSecretType(metadataName, data)
}
