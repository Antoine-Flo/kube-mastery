import { parse as yamlParse, stringify as yamlStringify } from 'yaml'
import type { FileSystem } from '../../../filesystem/FileSystem'
import { formatKubectlFileSystemError } from '../filesystemErrorPresenter'
import type { Result } from '../../../shared/result'
import { error, success } from '../../../shared/result'

const KUBECONFIG_PATH = '/home/kube/.kube/config'

export interface KubeconfigNamedCluster {
  name: string
  cluster: Record<string, unknown>
}

export interface KubeconfigNamedUser {
  name: string
  user: Record<string, unknown>
}

export interface KubeconfigNamedContext {
  name: string
  context: {
    cluster?: string
    user?: string
    namespace?: string
  }
}

export interface SimKubeconfig {
  apiVersion: string
  kind: string
  clusters: KubeconfigNamedCluster[]
  contexts: KubeconfigNamedContext[]
  'current-context': string
  preferences?: Record<string, unknown>
  users: KubeconfigNamedUser[]
}

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null
}

const toNamedCluster = (value: unknown): KubeconfigNamedCluster | undefined => {
  if (!isRecord(value)) {
    return undefined
  }
  if (typeof value.name !== 'string') {
    return undefined
  }
  if (!isRecord(value.cluster)) {
    return undefined
  }
  return {
    name: value.name,
    cluster: { ...value.cluster }
  }
}

const toNamedUser = (value: unknown): KubeconfigNamedUser | undefined => {
  if (!isRecord(value)) {
    return undefined
  }
  if (typeof value.name !== 'string') {
    return undefined
  }
  if (!isRecord(value.user)) {
    return undefined
  }
  return {
    name: value.name,
    user: { ...value.user }
  }
}

const toNamedContext = (value: unknown): KubeconfigNamedContext | undefined => {
  if (!isRecord(value)) {
    return undefined
  }
  if (typeof value.name !== 'string') {
    return undefined
  }
  if (!isRecord(value.context)) {
    return undefined
  }
  const cluster = value.context.cluster
  const user = value.context.user
  const namespace = value.context.namespace
  return {
    name: value.name,
    context: {
      cluster: typeof cluster === 'string' ? cluster : undefined,
      user: typeof user === 'string' ? user : undefined,
      namespace: typeof namespace === 'string' ? namespace : undefined
    }
  }
}

const toSimKubeconfig = (value: unknown): Result<SimKubeconfig> => {
  if (!isRecord(value)) {
    return error('kubeconfig is invalid: expected object')
  }

  const apiVersion =
    typeof value.apiVersion === 'string' ? value.apiVersion : 'v1'
  const kind = typeof value.kind === 'string' ? value.kind : 'Config'
  const currentContext =
    typeof value['current-context'] === 'string' ? value['current-context'] : ''

  const clustersRaw = Array.isArray(value.clusters) ? value.clusters : []
  const contextsRaw = Array.isArray(value.contexts) ? value.contexts : []
  const usersRaw = Array.isArray(value.users) ? value.users : []

  const clusters = clustersRaw
    .map((item) => toNamedCluster(item))
    .filter((item): item is KubeconfigNamedCluster => item !== undefined)
  const contexts = contextsRaw
    .map((item) => toNamedContext(item))
    .filter((item): item is KubeconfigNamedContext => item !== undefined)
  const users = usersRaw
    .map((item) => toNamedUser(item))
    .filter((item): item is KubeconfigNamedUser => item !== undefined)

  const preferences = isRecord(value.preferences) ? value.preferences : {}

  return success({
    apiVersion,
    kind,
    clusters,
    contexts,
    'current-context': currentContext,
    preferences,
    users
  })
}

export const readKubeconfigFromFileSystem = (
  fileSystem: FileSystem
): Result<SimKubeconfig> => {
  const kubeconfigReadResult = fileSystem.readFileDetailed(KUBECONFIG_PATH)
  if (!kubeconfigReadResult.ok) {
    return error(`kubeconfig file is missing: ${KUBECONFIG_PATH}`)
  }
  const kubeconfigRaw = kubeconfigReadResult.value
  if (kubeconfigRaw.length === 0) {
    return error(`kubeconfig file is empty: ${KUBECONFIG_PATH}`)
  }

  let parsedYaml: unknown
  try {
    parsedYaml = yamlParse(kubeconfigRaw)
  } catch {
    return error(`kubeconfig file is invalid YAML: ${KUBECONFIG_PATH}`)
  }

  return toSimKubeconfig(parsedYaml)
}

export const writeKubeconfigToFileSystem = (
  fileSystem: FileSystem,
  kubeconfig: SimKubeconfig
): Result<void> => {
  const serializedKubeconfig = yamlStringify(kubeconfig).trimEnd()
  const writeResult = fileSystem.writeFileDetailed(
    KUBECONFIG_PATH,
    serializedKubeconfig
  )
  if (!writeResult.ok) {
    return error(
      formatKubectlFileSystemError(writeResult.error, KUBECONFIG_PATH)
    )
  }
  return success(undefined)
}
