import type { EnvVar, Pod } from '../../../cluster/ressources/Pod'
import type { ApiServerFacade } from '../../../api/ApiServerFacade'
import type { Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'

const CONTAINER_PATH =
  'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'

const decodeBase64Value = (encodedValue: string): string | undefined => {
  try {
    if (typeof atob === 'function') {
      return atob(encodedValue)
    }
  } catch {
    // Ignore and try Node.js fallback.
  }
  try {
    if (
      typeof globalThis === 'object' &&
      'Buffer' in globalThis &&
      typeof (globalThis as { Buffer?: unknown }).Buffer === 'function'
    ) {
      const bufferCtor = (globalThis as {
        Buffer?: {
          from: (value: string, encoding: string) => {
            toString: (encoding: string) => string
          }
        }
      }).Buffer
      if (bufferCtor != null) {
        return bufferCtor.from(encodedValue, 'base64').toString('utf-8')
      }
    }
  } catch {
    return undefined
  }
  return undefined
}

const resolveEnvVarValue = (
  envVar: EnvVar,
  pod: Pod,
  apiServer?: ApiServerFacade
): string => {
  const { name, source } = envVar
  if (source.type === 'value') {
    return `${name}=${source.value}`
  }
  if (source.type === 'configMapKeyRef') {
    if (apiServer != null) {
      const configMapResult = apiServer.findResource(
        'ConfigMap',
        source.name,
        pod.metadata.namespace
      )
      if (configMapResult.ok) {
        const resolvedValue = configMapResult.value.data?.[source.key]
        if (resolvedValue != null) {
          return `${name}=${resolvedValue}`
        }
      }
    }
    return `${name}=<from configMap ${source.name}:${source.key}>`
  }
  if (source.type === 'secretKeyRef') {
    if (apiServer != null) {
      const secretResult = apiServer.findResource(
        'Secret',
        source.name,
        pod.metadata.namespace
      )
      if (secretResult.ok) {
        const encodedValue = secretResult.value.data[source.key]
        if (encodedValue != null) {
          const decodedValue = decodeBase64Value(encodedValue)
          if (decodedValue != null) {
            return `${name}=${decodedValue}`
          }
        }
      }
    }
    return `${name}=<from secret ${source.name}:${source.key}>`
  }
  return `${name}=unknown`
}

export const buildHostEnvironmentVariables = (): string[] => {
  return [CONTAINER_PATH, 'HOME=/home/kube', 'HOSTNAME=host-shell']
}

export const buildContainerEnvironmentVariables = (
  pod: Pod,
  containerName: string,
  apiServer?: ApiServerFacade
): Result<string[]> => {
  const container = pod.spec.containers.find((entry) => {
    return entry.name === containerName
  })
  if (container == null) {
    return error(
      `Error: container ${containerName} not found in pod ${pod.metadata.name}`
    )
  }
  const customEnvVars = (container.env ?? []).map((envVar) => {
    return resolveEnvVarValue(envVar, pod, apiServer)
  })
  return success([
    CONTAINER_PATH,
    'HOME=/root',
    `HOSTNAME=${pod.metadata.name}`,
    ...customEnvVars
  ])
}
