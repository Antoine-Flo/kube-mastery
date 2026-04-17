import type { FileSystem } from '../../../filesystem/FileSystem'
import { formatTable } from '../../../shared/formatter'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import type { ParsedCommand } from '../types'
import {
  renderStructuredPayload,
  resolveOutputDirective,
  validateOutputDirective
} from '../output/outputHelpers'
import {
  readKubeconfigFromFileSystem,
  type SimKubeconfig,
  writeKubeconfigToFileSystem
} from './configKubeconfig'

const OMITTED_CERTIFICATE_DATA = 'DATA+OMITTED'

const maskClusterCertificateData = (
  clusters: SimKubeconfig['clusters']
): SimKubeconfig['clusters'] => {
  return clusters.map((clusterEntry) => {
    const maskedCluster = { ...clusterEntry.cluster }
    if (typeof maskedCluster['certificate-authority-data'] === 'string') {
      maskedCluster['certificate-authority-data'] = OMITTED_CERTIFICATE_DATA
    }
    return {
      ...clusterEntry,
      cluster: maskedCluster
    }
  })
}

const maskUserCertificateData = (
  users: SimKubeconfig['users']
): SimKubeconfig['users'] => {
  return users.map((userEntry) => {
    const maskedUser = { ...userEntry.user }
    if (typeof maskedUser['client-certificate-data'] === 'string') {
      maskedUser['client-certificate-data'] = OMITTED_CERTIFICATE_DATA
    }
    if (typeof maskedUser['client-key-data'] === 'string') {
      maskedUser['client-key-data'] = OMITTED_CERTIFICATE_DATA
    }
    return {
      ...userEntry,
      user: maskedUser
    }
  })
}

const maskKubeconfigCertificateData = (
  kubeconfig: SimKubeconfig
): SimKubeconfig => {
  return {
    ...kubeconfig,
    clusters: maskClusterCertificateData(kubeconfig.clusters),
    users: maskUserCertificateData(kubeconfig.users)
  }
}

const getCurrentContextEntry = (
  kubeconfig: SimKubeconfig
): SimKubeconfig['contexts'][number] | undefined => {
  return kubeconfig.contexts.find((context) => {
    return context.name === kubeconfig['current-context']
  })
}

const handleConfigGetContexts = (
  kubeconfig: SimKubeconfig
): ExecutionResult => {
  const headers = ['current', 'name', 'cluster', 'authinfo', 'namespace']
  const rows = [...kubeconfig.contexts]
    .sort((left, right) => {
      return left.name.localeCompare(right.name)
    })
    .map((contextEntry) => {
      const isCurrent = kubeconfig['current-context'] === contextEntry.name
      return [
        isCurrent ? '*' : ' ',
        contextEntry.name,
        contextEntry.context.cluster || '',
        contextEntry.context.user || '',
        contextEntry.context.namespace || ''
      ]
    })
  return success(formatTable(headers, rows, { spacing: 3 }))
}

const handleConfigCurrentContext = (
  kubeconfig: SimKubeconfig
): ExecutionResult => {
  const currentContext = kubeconfig['current-context']
  if (currentContext.length === 0) {
    return error('current-context is not set')
  }
  return success(currentContext)
}

const handleConfigView = (
  kubeconfig: SimKubeconfig,
  parsed: ParsedCommand
): ExecutionResult => {
  const hasExplicitOutput =
    typeof parsed.flags.output === 'string' ||
    typeof parsed.flags['o'] === 'string'
  const fallbackOutput = hasExplicitOutput ? parsed.output : 'yaml'
  const outputDirectiveResult = validateOutputDirective(
    resolveOutputDirective(parsed.flags, fallbackOutput),
    ['yaml', 'json', 'jsonpath'],
    '--output must be one of: json|yaml|jsonpath'
  )
  if (!outputDirectiveResult.ok) {
    return error(outputDirectiveResult.error)
  }
  const outputDirective = outputDirectiveResult.value

  let payload: unknown
  if (parsed.configMinify !== true) {
    payload = maskKubeconfigCertificateData(kubeconfig)
  }
  const currentContext = kubeconfig['current-context']
  if (parsed.configMinify === true) {
    if (currentContext.length === 0) {
      return error('current-context is not set')
    }

    const currentContextEntry = getCurrentContextEntry(kubeconfig)
    if (!currentContextEntry) {
      return error(`context "${currentContext}" not found`)
    }

    const clusterName = currentContextEntry.context.cluster
    const userName = currentContextEntry.context.user
    const minifiedClusters = kubeconfig.clusters
      .filter((clusterEntry) => {
        return clusterEntry.name === clusterName
      })
      .map((clusterEntry) => {
        return {
          cluster: { ...clusterEntry.cluster },
          name: clusterEntry.name
        }
      })
    const minifiedContexts = [
      {
        context: { ...currentContextEntry.context },
        name: currentContextEntry.name
      }
    ]
    const minifiedUsers = kubeconfig.users
      .filter((userEntry) => {
        return userEntry.name === userName
      })
      .map((userEntry) => {
        return {
          name: userEntry.name,
          user: { ...userEntry.user }
        }
      })

    payload = {
      apiVersion: kubeconfig.apiVersion,
      clusters: maskClusterCertificateData(minifiedClusters),
      contexts: minifiedContexts,
      'current-context': currentContext,
      kind: kubeconfig.kind,
      users: maskUserCertificateData(minifiedUsers)
    }
  }

  const renderResult = renderStructuredPayload(payload, outputDirective)
  if (!renderResult.ok) {
    return error(renderResult.error)
  }
  return success(renderResult.value)
}

const handleConfigSetContext = (
  fileSystem: FileSystem,
  kubeconfig: SimKubeconfig,
  parsed: ParsedCommand
): ExecutionResult => {
  if (parsed.configCurrent !== true) {
    return error('config set-context currently supports only --current')
  }

  const namespace = parsed.configNamespace
  if (!namespace || namespace.length === 0) {
    return error('config set-context requires flag --namespace')
  }

  const currentContext = kubeconfig['current-context']
  if (currentContext.length === 0) {
    return error('no current context is set')
  }

  const currentContextExists = kubeconfig.contexts.some((contextEntry) => {
    return contextEntry.name === currentContext
  })
  if (!currentContextExists) {
    return error(`context "${currentContext}" not found`)
  }

  const updatedKubeconfig: SimKubeconfig = {
    ...kubeconfig,
    contexts: kubeconfig.contexts.map((contextEntry) => {
      if (contextEntry.name !== currentContext) {
        return contextEntry
      }
      return {
        ...contextEntry,
        context: {
          ...contextEntry.context,
          namespace
        }
      }
    })
  }
  const writeResult = writeKubeconfigToFileSystem(fileSystem, updatedKubeconfig)
  if (!writeResult.ok) {
    return error(writeResult.error)
  }
  return success(`Context "${currentContext}" modified.`)
}

const handleConfigUseContext = (
  fileSystem: FileSystem,
  kubeconfig: SimKubeconfig,
  parsed: ParsedCommand
): ExecutionResult => {
  const contextName = parsed.configContextName
  if (contextName == null || contextName.length === 0) {
    return error('config use-context requires a context name')
  }
  const contextExists = kubeconfig.contexts.some((contextEntry) => {
    return contextEntry.name === contextName
  })
  if (!contextExists) {
    return error(`error: no context exists with the name: "${contextName}"`)
  }
  const updatedKubeconfig: SimKubeconfig = {
    ...kubeconfig,
    'current-context': contextName
  }
  const writeResult = writeKubeconfigToFileSystem(fileSystem, updatedKubeconfig)
  if (!writeResult.ok) {
    return error(writeResult.error)
  }
  return success(`Switched to context "${contextName}".`)
}

const handleConfigGetClusters = (kubeconfig: SimKubeconfig): ExecutionResult => {
  const lines = ['NAME']
  for (const cluster of [...kubeconfig.clusters].sort((left, right) => {
    return left.name.localeCompare(right.name)
  })) {
    lines.push(cluster.name)
  }
  return success(lines.join('\n'))
}

const handleConfigGetUsers = (kubeconfig: SimKubeconfig): ExecutionResult => {
  const lines = ['NAME']
  for (const user of [...kubeconfig.users].sort((left, right) => {
    return left.name.localeCompare(right.name)
  })) {
    lines.push(user.name)
  }
  return success(lines.join('\n'))
}

const handleConfigSetCredentials = (
  fileSystem: FileSystem,
  kubeconfig: SimKubeconfig,
  parsed: ParsedCommand
): ExecutionResult => {
  const userName = parsed.configUserName
  const token = parsed.configToken
  if (userName == null || userName.length === 0) {
    return error('config set-credentials requires a user name')
  }
  if (token == null || token.length === 0) {
    return error('config set-credentials requires flag --token')
  }
  const nextUsers = [...kubeconfig.users]
  const existingIndex = nextUsers.findIndex((entry) => {
    return entry.name === userName
  })
  const nextUser = {
    name: userName,
    user: {
      ...(existingIndex >= 0 ? nextUsers[existingIndex].user : {}),
      token
    }
  }
  if (existingIndex >= 0) {
    nextUsers[existingIndex] = nextUser
  } else {
    nextUsers.push(nextUser)
  }
  const writeResult = writeKubeconfigToFileSystem(fileSystem, {
    ...kubeconfig,
    users: nextUsers
  })
  if (!writeResult.ok) {
    return error(writeResult.error)
  }
  return success(`User "${userName}" set.`)
}

const handleConfigSetCluster = (
  fileSystem: FileSystem,
  kubeconfig: SimKubeconfig,
  parsed: ParsedCommand
): ExecutionResult => {
  const clusterName = parsed.configClusterName
  const server = parsed.configServer
  if (clusterName == null || clusterName.length === 0) {
    return error('config set-cluster requires a cluster name')
  }
  if (server == null || server.length === 0) {
    return error('config set-cluster requires flag --server')
  }
  const nextClusters = [...kubeconfig.clusters]
  const existingIndex = nextClusters.findIndex((entry) => {
    return entry.name === clusterName
  })
  const nextCluster = {
    name: clusterName,
    cluster: {
      ...(existingIndex >= 0 ? nextClusters[existingIndex].cluster : {}),
      server
    }
  }
  if (existingIndex >= 0) {
    nextClusters[existingIndex] = nextCluster
  } else {
    nextClusters.push(nextCluster)
  }
  const writeResult = writeKubeconfigToFileSystem(fileSystem, {
    ...kubeconfig,
    clusters: nextClusters
  })
  if (!writeResult.ok) {
    return error(writeResult.error)
  }
  return success(`Cluster "${clusterName}" set.`)
}

const unsetNestedValue = (target: Record<string, unknown>, pathParts: string[]): boolean => {
  if (pathParts.length === 0) {
    return false
  }
  const [head, ...tail] = pathParts
  if (tail.length === 0) {
    if (!(head in target)) {
      return false
    }
    delete target[head]
    return true
  }
  const child = target[head]
  if (child == null || typeof child !== 'object') {
    return false
  }
  return unsetNestedValue(child as Record<string, unknown>, tail)
}

const handleConfigUnset = (
  fileSystem: FileSystem,
  kubeconfig: SimKubeconfig,
  parsed: ParsedCommand
): ExecutionResult => {
  const path = parsed.configPath
  if (path == null || path.length === 0) {
    return error('config unset requires a property path')
  }
  const pathParts = path.split('.').filter((part) => {
    return part.length > 0
  })
  if (pathParts.length === 0) {
    return error('config unset requires a property path')
  }
  const draft = structuredClone(kubeconfig) as SimKubeconfig
  let changed = false
  const rootKey = pathParts[0]
  const unsetInContextEntry = (
    entry: { context: Record<string, unknown> } & Record<string, unknown>,
    targetPathParts: string[]
  ): boolean => {
    if (targetPathParts.length === 0) {
      return false
    }
    if (targetPathParts[0] === 'context') {
      return unsetNestedValue(entry.context, targetPathParts.slice(1))
    }
    return unsetNestedValue(entry.context, targetPathParts)
  }
  const unsetInUserEntry = (
    entry: { user: Record<string, unknown> } & Record<string, unknown>,
    targetPathParts: string[]
  ): boolean => {
    if (targetPathParts.length === 0) {
      return false
    }
    if (targetPathParts[0] === 'user') {
      return unsetNestedValue(entry.user, targetPathParts.slice(1))
    }
    return unsetNestedValue(entry.user, targetPathParts)
  }
  const unsetInClusterEntry = (
    entry: { cluster: Record<string, unknown> } & Record<string, unknown>,
    targetPathParts: string[]
  ): boolean => {
    if (targetPathParts.length === 0) {
      return false
    }
    if (targetPathParts[0] === 'cluster') {
      return unsetNestedValue(entry.cluster, targetPathParts.slice(1))
    }
    return unsetNestedValue(entry.cluster, targetPathParts)
  }
  if (rootKey === 'contexts' && pathParts.length >= 3) {
    const contextName = pathParts[1]
    const contextEntry = draft.contexts.find((entry) => {
      return entry.name === contextName
    })
    if (contextEntry != null) {
      changed = unsetInContextEntry(
        contextEntry as unknown as { context: Record<string, unknown> } & Record<
          string,
          unknown
        >,
        pathParts.slice(2)
      )
    }
  } else if (rootKey === 'users' && pathParts.length >= 3) {
    const userName = pathParts[1]
    const userEntry = draft.users.find((entry) => {
      return entry.name === userName
    })
    if (userEntry != null) {
      changed = unsetInUserEntry(
        userEntry as unknown as { user: Record<string, unknown> } & Record<
          string,
          unknown
        >,
        pathParts.slice(2)
      )
    }
  } else if (rootKey === 'clusters' && pathParts.length >= 3) {
    const clusterName = pathParts[1]
    const clusterEntry = draft.clusters.find((entry) => {
      return entry.name === clusterName
    })
    if (clusterEntry != null) {
      changed = unsetInClusterEntry(
        clusterEntry as unknown as { cluster: Record<string, unknown> } & Record<
          string,
          unknown
        >,
        pathParts.slice(2)
      )
    }
  } else {
    changed = unsetNestedValue(draft as unknown as Record<string, unknown>, pathParts)
  }
  if (!changed) {
    return error(`error: property "${path}" does not exist`)
  }
  const writeResult = writeKubeconfigToFileSystem(fileSystem, draft)
  if (!writeResult.ok) {
    return error(writeResult.error)
  }
  return success(`Property "${path}" unset.`)
}

const handleConfigRenameContext = (
  fileSystem: FileSystem,
  kubeconfig: SimKubeconfig,
  parsed: ParsedCommand
): ExecutionResult => {
  const oldName = parsed.configContextName
  const newName = parsed.configRenameContextTo
  if (
    oldName == null ||
    oldName.length === 0 ||
    newName == null ||
    newName.length === 0
  ) {
    return error('config rename-context requires <old-name> <new-name>')
  }
  const contextIndex = kubeconfig.contexts.findIndex((entry) => {
    return entry.name === oldName
  })
  if (contextIndex < 0) {
    return error(`error: cannot rename the context "${oldName}", it's not in ${'<config>'}`)
  }
  const newNameExists = kubeconfig.contexts.some((entry) => {
    return entry.name === newName
  })
  if (newNameExists) {
    return error(`error: cannot rename the context "${oldName}", the context "${newName}" already exists`)
  }
  const nextContexts = [...kubeconfig.contexts]
  nextContexts[contextIndex] = {
    ...nextContexts[contextIndex],
    name: newName
  }
  const nextCurrentContext =
    kubeconfig['current-context'] === oldName
      ? newName
      : kubeconfig['current-context']
  const writeResult = writeKubeconfigToFileSystem(fileSystem, {
    ...kubeconfig,
    contexts: nextContexts,
    'current-context': nextCurrentContext
  })
  if (!writeResult.ok) {
    return error(writeResult.error)
  }
  return success(`Context "${oldName}" renamed to "${newName}".`)
}

export const getCurrentNamespaceFromKubeconfig = (
  fileSystem: FileSystem
): string | undefined => {
  const kubeconfigResult = readKubeconfigFromFileSystem(fileSystem)
  if (!kubeconfigResult.ok) {
    return undefined
  }

  const currentContext = kubeconfigResult.value['current-context']
  if (currentContext.length === 0) {
    return undefined
  }

  const currentContextEntry = kubeconfigResult.value.contexts.find(
    (contextEntry) => {
      return contextEntry.name === currentContext
    }
  )
  if (!currentContextEntry) {
    return undefined
  }

  const namespace = currentContextEntry.context.namespace
  if (typeof namespace !== 'string' || namespace.length === 0) {
    return undefined
  }
  return namespace
}

export const handleConfig = (
  fileSystem: FileSystem,
  parsed: ParsedCommand
): ExecutionResult => {
  const kubeconfigResult = readKubeconfigFromFileSystem(fileSystem)
  if (!kubeconfigResult.ok) {
    return error(kubeconfigResult.error)
  }

  if (parsed.action === 'config-get-contexts') {
    return handleConfigGetContexts(kubeconfigResult.value)
  }

  if (parsed.action === 'config-current-context') {
    return handleConfigCurrentContext(kubeconfigResult.value)
  }

  if (parsed.action === 'config-view') {
    return handleConfigView(kubeconfigResult.value, parsed)
  }

  if (parsed.action === 'config-set-context') {
    return handleConfigSetContext(fileSystem, kubeconfigResult.value, parsed)
  }

  if (parsed.action === 'config-use-context') {
    return handleConfigUseContext(fileSystem, kubeconfigResult.value, parsed)
  }

  if (parsed.action === 'config-get-clusters') {
    return handleConfigGetClusters(kubeconfigResult.value)
  }

  if (parsed.action === 'config-get-users') {
    return handleConfigGetUsers(kubeconfigResult.value)
  }

  if (parsed.action === 'config-set-credentials') {
    return handleConfigSetCredentials(fileSystem, kubeconfigResult.value, parsed)
  }

  if (parsed.action === 'config-set-cluster') {
    return handleConfigSetCluster(fileSystem, kubeconfigResult.value, parsed)
  }

  if (parsed.action === 'config-unset') {
    return handleConfigUnset(fileSystem, kubeconfigResult.value, parsed)
  }

  if (parsed.action === 'config-rename-context') {
    return handleConfigRenameContext(fileSystem, kubeconfigResult.value, parsed)
  }

  return error(`Unknown config action: ${parsed.action}`)
}
