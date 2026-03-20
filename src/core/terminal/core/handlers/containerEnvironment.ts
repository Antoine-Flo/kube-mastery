import type { EnvVar, Pod } from '../../../cluster/ressources/Pod'
import type { Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'

const CONTAINER_PATH =
  'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'

const resolveEnvVarValue = (envVar: EnvVar): string => {
  const { name, source } = envVar
  if (source.type === 'value') {
    return `${name}=${source.value}`
  }
  if (source.type === 'configMapKeyRef') {
    return `${name}=<from configMap ${source.name}:${source.key}>`
  }
  if (source.type === 'secretKeyRef') {
    return `${name}=<from secret ${source.name}:${source.key}>`
  }
  return `${name}=unknown`
}

export const buildHostEnvironmentVariables = (): string[] => {
  return [CONTAINER_PATH, 'HOME=/home/kube', 'HOSTNAME=host-shell']
}

export const buildContainerEnvironmentVariables = (
  pod: Pod,
  containerName: string
): Result<string[]> => {
  const container = pod.spec.containers.find((entry) => {
    return entry.name === containerName
  })
  if (container == null) {
    return error(
      `Error: container ${containerName} not found in pod ${pod.metadata.name}`
    )
  }
  const customEnvVars = (container.env ?? []).map(resolveEnvVarValue)
  return success([
    CONTAINER_PATH,
    'HOME=/root',
    `HOSTNAME=${pod.metadata.name}`,
    ...customEnvVars
  ])
}
