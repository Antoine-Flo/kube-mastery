import type { FileSystem } from '../../../filesystem/FileSystem'
import { formatTable } from '../../../shared/formatter'
import type { ExecutionResult } from '../../../shared/result'
import {
  error,
  success,
  toNeverthrowResult
} from '../../../shared/result'
import type { ParsedCommand } from '../types'
import {
  renderStructuredPayload,
  resolveOutputDirective,
  validateOutputDirective
} from '../output/outputHelpers'
import { dispatchByAction } from '../shared/actionDispatch'
import {
  readKubeconfigFromFileSystem,
  type SimKubeconfig,
  writeKubeconfigToFileSystem
} from './configKubeconfig'
import { map, pipe, sortBy } from 'remeda'
import { err as ntErr, ok as ntOk, type Result as NtResult } from 'neverthrow'

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

const resolveCurrentNamespaceFromKubeconfig = (
  kubeconfig: SimKubeconfig
): string | undefined => {
  const currentContext = kubeconfig['current-context']
  if (currentContext.length === 0) {
    return undefined
  }
  const currentContextEntry = getCurrentContextEntry(kubeconfig)
  if (currentContextEntry == null) {
    return undefined
  }
  const namespace = currentContextEntry.context.namespace
  if (typeof namespace !== 'string' || namespace.length === 0) {
    return undefined
  }
  return namespace
}

const writeKubeconfigAndReturnMessage = (
  fileSystem: FileSystem,
  kubeconfig: SimKubeconfig,
  successMessage: string
): ExecutionResult => {
  const writeResult = writeKubeconfigToFileSystem(fileSystem, kubeconfig)
  if (!writeResult.ok) {
    return error(writeResult.error)
  }
  return success(successMessage)
}

const handleConfigGetContexts = (
  kubeconfig: SimKubeconfig
): ExecutionResult => {
  const headers = ['current', 'name', 'cluster', 'authinfo', 'namespace']
  const rows = pipe(
    kubeconfig.contexts,
    sortBy((contextEntry) => {
      return contextEntry.name
    }),
    map((contextEntry) => {
      const isCurrent = kubeconfig['current-context'] === contextEntry.name
      return [
        isCurrent ? '*' : ' ',
        contextEntry.name,
        contextEntry.context.cluster || '',
        contextEntry.context.user || '',
        contextEntry.context.namespace || ''
      ]
    })
  )
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
  const outputDirectiveResult = toNeverthrowResult(
    validateOutputDirective(
      resolveOutputDirective(parsed.flags, fallbackOutput),
      ['yaml', 'json', 'jsonpath'],
      '--output must be one of: json|yaml|jsonpath'
    )
  )

  const payloadResult: NtResult<string, string> = outputDirectiveResult.andThen(
    (outputDirective) => {
      const currentContext = kubeconfig['current-context']
      let payload: unknown = maskKubeconfigCertificateData(kubeconfig)
      if (parsed.configMinify !== true) {
        return ntOk({ outputDirective, payload })
      }
      if (currentContext.length === 0) {
        return ntErr('current-context is not set')
      }
      const currentContextEntry = getCurrentContextEntry(kubeconfig)
      if (!currentContextEntry) {
        return ntErr(`context "${currentContext}" not found`)
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
        contexts: [
          {
            context: { ...currentContextEntry.context },
            name: currentContextEntry.name
          }
        ],
        'current-context': currentContext,
        kind: kubeconfig.kind,
        users: maskUserCertificateData(minifiedUsers)
      }
      return ntOk({ outputDirective, payload })
    }
  ).andThen(({ outputDirective, payload }) => {
    return toNeverthrowResult(renderStructuredPayload(payload, outputDirective))
  })

  return payloadResult.match(
    (renderedPayload) => {
      return success(renderedPayload)
    },
    (errorMessage) => {
      return error(errorMessage)
    }
  )
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
  return writeKubeconfigAndReturnMessage(
    fileSystem,
    updatedKubeconfig,
    `Context "${currentContext}" modified.`
  )
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
  return writeKubeconfigAndReturnMessage(
    fileSystem,
    updatedKubeconfig,
    `Switched to context "${contextName}".`
  )
}

const handleConfigGetClusters = (kubeconfig: SimKubeconfig): ExecutionResult => {
  const lines = pipe(
    kubeconfig.clusters,
    sortBy((cluster) => {
      return cluster.name
    }),
    map((cluster) => {
      return cluster.name
    })
  )
  lines.unshift('NAME')
  return success(lines.join('\n'))
}

const handleConfigGetUsers = (kubeconfig: SimKubeconfig): ExecutionResult => {
  const lines = pipe(
    kubeconfig.users,
    sortBy((user) => {
      return user.name
    }),
    map((user) => {
      return user.name
    })
  )
  lines.unshift('NAME')
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
  return writeKubeconfigAndReturnMessage(
    fileSystem,
    {
      ...kubeconfig,
      users: nextUsers
    },
    `User "${userName}" set.`
  )
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
  return writeKubeconfigAndReturnMessage(
    fileSystem,
    {
      ...kubeconfig,
      clusters: nextClusters
    },
    `Cluster "${clusterName}" set.`
  )
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

const unsetInEntryField = (
  entry: Record<string, unknown>,
  fieldName: 'context' | 'user' | 'cluster',
  targetPathParts: string[]
): boolean => {
  if (targetPathParts.length === 0) {
    return false
  }
  const fieldTarget = entry[fieldName]
  if (fieldTarget == null || typeof fieldTarget !== 'object') {
    return false
  }
  const normalizedPathParts =
    targetPathParts[0] === fieldName
      ? targetPathParts.slice(1)
      : targetPathParts
  return unsetNestedValue(
    fieldTarget as Record<string, unknown>,
    normalizedPathParts
  )
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
  if (rootKey === 'contexts' && pathParts.length >= 3) {
    const contextName = pathParts[1]
    const contextEntry = draft.contexts.find((entry) => {
      return entry.name === contextName
    })
    if (contextEntry != null) {
      changed = unsetInEntryField(
        contextEntry as unknown as Record<string, unknown>,
        'context',
        pathParts.slice(2)
      )
    }
  } else if (rootKey === 'users' && pathParts.length >= 3) {
    const userName = pathParts[1]
    const userEntry = draft.users.find((entry) => {
      return entry.name === userName
    })
    if (userEntry != null) {
      changed = unsetInEntryField(
        userEntry as unknown as Record<string, unknown>,
        'user',
        pathParts.slice(2)
      )
    }
  } else if (rootKey === 'clusters' && pathParts.length >= 3) {
    const clusterName = pathParts[1]
    const clusterEntry = draft.clusters.find((entry) => {
      return entry.name === clusterName
    })
    if (clusterEntry != null) {
      changed = unsetInEntryField(
        clusterEntry as unknown as Record<string, unknown>,
        'cluster',
        pathParts.slice(2)
      )
    }
  } else {
    changed = unsetNestedValue(draft as unknown as Record<string, unknown>, pathParts)
  }
  if (!changed) {
    return error(`error: property "${path}" does not exist`)
  }
  return writeKubeconfigAndReturnMessage(
    fileSystem,
    draft,
    `Property "${path}" unset.`
  )
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
  return writeKubeconfigAndReturnMessage(
    fileSystem,
    {
      ...kubeconfig,
      contexts: nextContexts,
      'current-context': nextCurrentContext
    },
    `Context "${oldName}" renamed to "${newName}".`
  )
}

export const getCurrentNamespaceFromKubeconfig = (
  fileSystem: FileSystem
): string | undefined => {
  const kubeconfigResult = readKubeconfigFromFileSystem(fileSystem)
  if (!kubeconfigResult.ok) {
    return undefined
  }
  return resolveCurrentNamespaceFromKubeconfig(kubeconfigResult.value)
}

export const handleConfig = (
  fileSystem: FileSystem,
  parsed: ParsedCommand
): ExecutionResult => {
  const kubeconfigResult = readKubeconfigFromFileSystem(fileSystem)
  if (!kubeconfigResult.ok) {
    return error(kubeconfigResult.error)
  }
  const kubeconfig = kubeconfigResult.value
  const actionHandlers: Partial<
    Record<ParsedCommand['action'], () => ExecutionResult>
  > = {
    'config-get-contexts': () => {
      return handleConfigGetContexts(kubeconfig)
    },
    'config-current-context': () => {
      return handleConfigCurrentContext(kubeconfig)
    },
    'config-view': () => {
      return handleConfigView(kubeconfig, parsed)
    },
    'config-set-context': () => {
      return handleConfigSetContext(fileSystem, kubeconfig, parsed)
    },
    'config-use-context': () => {
      return handleConfigUseContext(fileSystem, kubeconfig, parsed)
    },
    'config-get-clusters': () => {
      return handleConfigGetClusters(kubeconfig)
    },
    'config-get-users': () => {
      return handleConfigGetUsers(kubeconfig)
    },
    'config-set-credentials': () => {
      return handleConfigSetCredentials(fileSystem, kubeconfig, parsed)
    },
    'config-set-cluster': () => {
      return handleConfigSetCluster(fileSystem, kubeconfig, parsed)
    },
    'config-unset': () => {
      return handleConfigUnset(fileSystem, kubeconfig, parsed)
    },
    'config-rename-context': () => {
      return handleConfigRenameContext(fileSystem, kubeconfig, parsed)
    }
  }
  return dispatchByAction(parsed.action, actionHandlers, (action) => {
    return error(`Unknown config action: ${action}`)
  })
}
