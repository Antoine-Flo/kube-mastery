import { stringify as yamlStringify } from 'yaml'
import type {
  ClusterState,
  ClusterStateData
} from '../../../cluster/ClusterState'
import { formatTable } from '../../../shared/formatter'
import type { ExecutionResult } from '../../../shared/result'
import { error, success } from '../../../shared/result'
import type { ParsedCommand } from '../types'
import {
  readKubeconfigFromState,
  type SimKubeconfig,
  writeKubeconfigToClusterInfo
} from './configKubeconfig'

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
  if (parsed.configMinify !== true) {
    return success(yamlStringify(kubeconfig).trimEnd())
  }

  const currentContext = kubeconfig['current-context']
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

  const minifiedConfig = {
    apiVersion: kubeconfig.apiVersion,
    clusters: minifiedClusters,
    contexts: minifiedContexts,
    'current-context': currentContext,
    kind: kubeconfig.kind,
    users: minifiedUsers
  }
  return success(yamlStringify(minifiedConfig).trimEnd())
}

const handleConfigSetContext = (
  clusterState: ClusterState,
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
  const writeResult = writeKubeconfigToClusterInfo(
    clusterState,
    updatedKubeconfig
  )
  if (!writeResult.ok) {
    return error(writeResult.error)
  }
  return success(`Context "${currentContext}" modified.`)
}

export const getCurrentNamespaceFromKubeconfig = (
  state: ClusterStateData
): string | undefined => {
  const kubeconfigResult = readKubeconfigFromState(state)
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
  clusterState: ClusterState,
  parsed: ParsedCommand
): ExecutionResult => {
  const kubeconfigResult = readKubeconfigFromState(clusterState.toJSON())
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
    return handleConfigSetContext(clusterState, kubeconfigResult.value, parsed)
  }

  return error(`Unknown config action: ${parsed.action}`)
}
